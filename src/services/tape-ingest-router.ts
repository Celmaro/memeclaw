import type { GMGNTrackTrade, SolChain } from '../adapters/gmgn-adapter.js';
import type { DecisionMemory } from './decision-memory.js';
import type { FomoFillEvidence, FomoWalletResolver } from './fomo-wallet-resolver.js';
import type { CalloutEventEntry, StateStore } from './state-store.js';
import { normalizeTape, type NormalizedTape, type TapeChain } from './tape-normalizer.js';
import type { WalletCohortTracker } from './wallet-cohort-tracker.js';

export interface TapeIngestDeps {
  stateStore?: StateStore;
  walletCohort?: WalletCohortTracker;
  fomoResolver?: FomoWalletResolver;
  decisionMemory?: DecisionMemory;
}

export interface TapeIngestOptions {
  source?: string;
  chain?: TapeChain;
}

export interface TapeIngestResult {
  success: boolean;
  error?: string;
  normalized?: NormalizedTape;
  duplicate?: boolean;
  stored?: boolean;
  fomoIngested?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim());
}

/**
 * Deterministic RH/Fomo tape ingestion router. It normalizes first, dedupes on
 * the event envelope, persists to the callout ledger, feeds wallet-cohort
 * evidence, and optionally feeds profile -> wallet maker-window evidence into
 * the Fomo resolver when the push payload carries a profileId. It never signs,
 * never broadcasts, and never lets a raw webhook shape leak into execution.
 */
export class TapeIngestRouter {
  private readonly recent = new Map<string, NormalizedTape>();

  constructor(private readonly deps: TapeIngestDeps = {}) {}

  public ingest(raw: unknown, options: TapeIngestOptions = {}): TapeIngestResult {
    const normalized = normalizeTape(raw, options.source ?? 'tape', options.chain);
    if (!normalized) {
      return { success: false, error: 'Malformed tape payload or unsupported chain' };
    }

    let duplicate = false;
    let stored = false;
    if (this.deps.stateStore) {
      const dedupe = this.deps.stateStore.getAllDedupEntries();
      duplicate = Boolean(dedupe[normalized.envelope.dedupeKey]);
      if (!duplicate) {
        const entry: CalloutEventEntry = {
          id: `TAPE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: normalized.envelope.occurredAt,
          traceId: normalized.envelope.traceId,
          source: normalized.envelope.source,
          kind: normalized.envelope.kind,
          chain: normalized.chain,
          tokenAddress: normalized.tokenAddress,
          tokenSymbol: normalized.tokenSymbol || '',
          side: normalized.side === 'unknown' ? undefined : normalized.side,
          maker: normalized.wallet,
          amountUsd: normalized.amountUsd,
          envelopeId: normalized.envelope.eventId,
          dedupeKey: normalized.envelope.dedupeKey,
          rawPayloadJson: JSON.stringify(raw),
        };
        this.deps.stateStore.appendCallout(entry);
        this.deps.stateStore.setDedupEntry(normalized.envelope.dedupeKey, Date.now());
        stored = true;
      }
    }

    let fomoIngested = false;
    if (!duplicate) {
      if (this.deps.decisionMemory) {
        this.deps.decisionMemory.recordSignal({
          traceId: normalized.envelope.traceId,
          source: normalized.envelope.source,
          chain: normalized.chain,
          tokenAddress: normalized.tokenAddress ?? undefined,
          tokenSymbol: normalized.tokenSymbol,
          rawPayloadJson: JSON.stringify(raw),
        });
      }

      if (this.deps.walletCohort) {
        this.feedWalletCohort(normalized);
      }

      if (this.deps.fomoResolver) {
        fomoIngested = this.feedFomoResolver(raw, normalized);
      }
    }

    this.recent.set(normalized.envelope.dedupeKey, normalized);
    if (this.recent.size > 1000) {
      const oldest = this.recent.keys().next().value;
      if (oldest) this.recent.delete(oldest);
    }

    return {
      success: true,
      normalized,
      duplicate,
      stored,
      fomoIngested,
    };
  }

  public recentEvents(limit = 50): NormalizedTape[] {
    return Array.from(this.recent.values()).slice(0, limit);
  }

  private feedWalletCohort(normalized: NormalizedTape): void {
    if (!this.deps.walletCohort || !normalized.tokenAddress || !normalized.wallet) return;
    if (normalized.side !== 'buy' && normalized.side !== 'sell') return;

    const trade: GMGNTrackTrade = {
      tokenAddress: normalized.tokenAddress,
      tokenSymbol: normalized.tokenSymbol || '',
      side: normalized.side,
      amountUsd: normalized.amountUsd,
      isFullClose: false,
      maker: normalized.wallet,
      makerTags: [],
      timestamp: normalized.occurredAt.getTime(),
      kind: 'smartmoney',
    };

    this.deps.walletCohort.ingest(normalized.chain as SolChain, [trade]);
  }

  private feedFomoResolver(raw: unknown, normalized: NormalizedTape): boolean {
    if (!this.deps.fomoResolver) return false;
    const record = asRecord(raw);
    const profileId = firstString(record.profileId, record.profile, record.traderId, record.trader);
    if (!profileId) return false;

    const explicitMakers = asStringArray(record.makerCandidates ?? record.makers);
    const makerCandidates = explicitMakers.length > 0 ? explicitMakers : normalized.wallet ? [normalized.wallet] : [];
    if (makerCandidates.length === 0) return false;

    const nowMs = Date.now();
    const windowStart = firstNumber(record.windowStart, record.window_start) || normalized.occurredAt.getTime() - 30_000;
    const windowEnd = firstNumber(record.windowEnd, record.window_end) || normalized.occurredAt.getTime();

    const fill: FomoFillEvidence = {
      profileId,
      windowStart,
      windowEnd,
      makerCandidates,
      tokenAddress: normalized.tokenAddress ?? undefined,
      tokenSymbol: normalized.tokenSymbol,
      side: normalized.side === 'unknown' ? undefined : normalized.side,
      amountUsd: normalized.amountUsd,
      txHash: normalized.txHash,
    };

    this.deps.fomoResolver.ingestFill(fill);
    return true;
  }
}

/**
 * Process-wide tape router. The REST API and any future Fomo listener share
 * the same dedupe and evidence path instead of loading separate copies.
 */
export const globalTapeIngestRouter = new TapeIngestRouter();
