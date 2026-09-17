import { createEventEnvelope, type EventEnvelope, type ChainId } from '../domain/event-envelope.js';
import type { CalloutEventEntry, StateStore } from './state-store.js';
import type { GMGNTrackTrade, SolChain } from '../adapters/gmgn-adapter.js';
import type { WalletCohortTracker } from './wallet-cohort-tracker.js';

const SUPPORTED_CHAINS: readonly ChainId[] = ['sol', 'base', 'eth', 'bsc', 'robinhood', 'ink'];

export interface GMGNCalloutPayload {
  eventType: string;
  tokenAddress: string | null;
  tokenSymbol: string;
  side?: 'buy' | 'sell';
  maker?: string;
  amountUsd: number;
  raw: unknown;
}

export interface NormalizedGMGNCallout {
  envelope: EventEnvelope<GMGNCalloutPayload>;
  chain: ChainId | null;
  tokenAddress: string | null;
  tokenSymbol: string;
  side?: 'buy' | 'sell';
  maker?: string;
  amountUsd: number;
  duplicate?: boolean;
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

function normalizeAddress(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith('0x') ? value.toLowerCase() : value.toLowerCase();
}

function chainFrom(raw: unknown): ChainId | null {
  const record = asRecord(raw);
  const data = asRecord(record.data);
  const token = asRecord(data.token ?? record.token);
  const chain = firstString(record.chain, data.chain, token.chain);
  if (chain && SUPPORTED_CHAINS.includes(chain as ChainId)) {
    return chain as ChainId;
  }
  return null;
}

function timestampFrom(raw: unknown): Date {
  const record = asRecord(raw);
  const data = asRecord(record.data);
  const rawTs = firstNumber(record.timestamp, data.timestamp, record.trigger_at, data.trigger_at);
  if (rawTs > 0) {
    const ms = rawTs > 1_000_000_000_000 ? rawTs : rawTs * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

/**
 * Normalizes GMGN push/webhook payloads into the internal event envelope.
 *
 * This is the P0 callout/openapi borrowing: agent should not depend only on
 * 5-minute polling. It is deterministic, read-only, de-duplicating, and returns
 * a normalized signal that downstream algorithms can gate or tag.
 */
export class GMGNCalloutRouter {
  private recent = new Map<string, EventEnvelope<GMGNCalloutPayload>>();

  constructor(private readonly deps: {
    stateStore?: StateStore;
    walletCohort?: WalletCohortTracker;
  } = {}) {}

  public ingest(raw: unknown): NormalizedGMGNCallout {
    const record = asRecord(raw);
    const data = asRecord(record.data);
    const token = asRecord(data.token ?? record.token);

    const eventType = firstString(record.event, record.type, record.event_type, data.event, data.type) || 'UNKNOWN';
    const tokenAddress = normalizeAddress(
      firstString(
        data.token_address,
        data.address,
        data.base_address,
        token.address,
        token.token_address,
        record.token_address,
        record.address
      )
    );
    const tokenSymbol = firstString(data.symbol, token.symbol, record.symbol) || '';
    const rawSide = firstString(data.side, record.side) || '';
    const side = rawSide.toLowerCase() === 'sell' ? 'sell' : rawSide.toLowerCase() === 'buy' ? 'buy' : undefined;
    const maker = firstString(data.maker, data.wallet, data.wallet_address, record.maker, record.wallet) || undefined;
    const amountUsd = firstNumber(data.amount_usd, data.amountUsd, record.amount_usd, record.amountUsd);
    const chain = chainFrom(raw);
    const occurredAt = timestampFrom(raw);
    const txHash = firstString(data.tx_hash, record.tx_hash);
    const sourceEventId = firstString(data.event_id, data.signal_id, data.id, record.event_id, record.id);

    const payload: GMGNCalloutPayload = {
      eventType: String(eventType).toUpperCase(),
      tokenAddress,
      tokenSymbol,
      side,
      maker,
      amountUsd,
      raw,
    };

    const envelope = createEventEnvelope({
      traceId: `callout_${occurredAt.getTime()}_${tokenAddress || eventType}`,
      source: 'gmgn-callout',
      kind: String(eventType).toLowerCase(),
      occurredAt,
      context: {
        chain: chain ?? 'sol',
        txHash,
        sourceEventId,
      },
      payload,
    });

    let duplicate = false;
    if (this.deps.stateStore) {
      const persisted = this.deps.stateStore.getAllDedupEntries();
      duplicate = Boolean(persisted[envelope.dedupeKey]);
      if (!duplicate) {
        const entry: CalloutEventEntry = {
          id: `CALLOUT_${occurredAt.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
          timestamp: envelope.occurredAt,
          traceId: envelope.traceId,
          source: envelope.source,
          kind: envelope.kind,
          chain: chain ?? 'sol',
          tokenAddress,
          tokenSymbol,
          side,
          maker,
          amountUsd,
          envelopeId: envelope.eventId,
          dedupeKey: envelope.dedupeKey,
          rawPayloadJson: JSON.stringify(raw),
        };
        this.deps.stateStore.appendCallout(entry);
        this.deps.stateStore.setDedupEntry(envelope.dedupeKey, occurredAt.getTime());
      }
    }

    if (this.deps.walletCohort && chain && tokenAddress && maker && (side === 'buy' || side === 'sell')) {
      const track: GMGNTrackTrade = {
        tokenAddress,
        tokenSymbol,
        side,
        amountUsd,
        isFullClose: false,
        maker,
        makerTags: [],
        timestamp: occurredAt.getTime(),
        kind: 'kol',
      };
      this.deps.walletCohort.ingest(chain as SolChain, [track]);
    }

    this.recent.set(envelope.dedupeKey, envelope);
    if (this.recent.size > 500) {
      const oldest = this.recent.keys().next().value;
      if (oldest) this.recent.delete(oldest);
    }

    return {
      envelope,
      chain,
      tokenAddress,
      tokenSymbol,
      side,
      maker,
      amountUsd,
      duplicate,
    };
  }

  public hasRecent(dedupeKey: string): boolean {
    return this.recent.has(dedupeKey);
  }

  public recentEvents(limit = 20): EventEnvelope<GMGNCalloutPayload>[] {
    return Array.from(this.recent.values()).slice(0, limit);
  }
}
