import type { GMGNTrackTrade, SolChain } from '../adapters/gmgn-adapter.js';

export type WalletCohortSignalType = 'CONVERGENCE' | 'ROTATION' | 'DORMANT_WAKE';

export interface WalletCohortSignal {
  type: WalletCohortSignalType;
  chain: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  wallets: string[];
  totalBuyUsd?: number;
  soldTokenAddress?: string;
  boughtTokenAddress?: string;
  score: number;
  note: string;
  ts: number;
}

export interface WalletCohortTrackerDeps {
  /** Distinct wallets that must buy the same token before a convergence fires. */
  minConvergenceWallets?: number;
  /** Combined USD buy value for a convergence. */
  minConvergenceBuyUsd?: number;
  /** Fresh window for convergence. */
  convergenceWindowMs?: number;
  /** Sell -> buy window for rotation per wallet. */
  rotationWindowMs?: number;
  /** Minimum buy USD for a rotation leg. */
  rotationMinBuyUsd?: number;
  /** Wallet inactivity before a new buy counts as a dormant wake. */
  dormantWindowMs?: number;
  /** Minimum signal repeat gap. */
  signalCooldownMs?: number;
  /** Events older than this are pruned from in-memory history. */
  historyTtlMs?: number;
}

interface WalletActivity {
  chain: string;
  events: GMGNTrackTrade[];
  lastSeenAt: number;
}

const DEFAULT_DEPENDENCIES = {
  minConvergenceWallets: 3,
  minConvergenceBuyUsd: 15_000,
  convergenceWindowMs: 15 * 60 * 1000,
  rotationWindowMs: 10 * 60 * 1000,
  rotationMinBuyUsd: 2_500,
  dormantWindowMs: 7 * 24 * 60 * 60 * 1000,
  signalCooldownMs: 15 * 60 * 1000,
  historyTtlMs: 30 * 24 * 60 * 60 * 1000,
} as const;

function keyForSignal(sig: Pick<WalletCohortSignal, 'type' | 'tokenAddress' | 'chain' | 'boughtTokenAddress'>): string {
  const a = sig.tokenAddress?.toLowerCase() || '';
  const b = sig.boughtTokenAddress?.toLowerCase() || '';
  return `${sig.chain}:${sig.type}:${a}:${b}`;
}

/**
 * Wallet-cohort intelligence borrowed from the study corpus: FlySwarm, MEERKAT,
 * PELLET and stampede all use raw wallet fills to find repeatable, evidence-first
 * patterns instead of trusting a single whale fill. This service keeps a bounded
 * in-memory event history and emits convergence, rotation and dormant-wake signals.
 * It never signs or broadcasts trades, no LLM is required, and it fails open
 * (empty results) when a feed is unavailable.
 */
export class WalletCohortTracker {
  private activities = new Map<string, WalletActivity>();
  private lastEmittedAt = new Map<string, number>();
  private deps: Required<WalletCohortTrackerDeps>;

  constructor(deps: WalletCohortTrackerDeps = {}) {
    this.deps = { ...DEFAULT_DEPENDENCIES, ...deps };
  }

  public ingest(chain: SolChain, trades: GMGNTrackTrade[]): void {
    const nowMs = Date.now();
    for (const t of trades) {
      if (!t.maker || !t.tokenAddress) continue;
      const key = `${chain}:${t.maker.toLowerCase()}`;
      let activity = this.activities.get(key);
      if (!activity) {
        activity = { chain, events: [], lastSeenAt: 0 };
        this.activities.set(key, activity);
      }
      const tsMs = t.timestamp > 1_000_000_000_000 ? t.timestamp : t.timestamp * 1000;
      if (tsMs > activity.lastSeenAt) activity.lastSeenAt = tsMs;
      if (tsMs > nowMs - this.deps.historyTtlMs) {
        activity.events.push(t);
      }
    }

    // Prune dead wallet keys and old events to keep memory bounded.
    for (const [key, activity] of this.activities) {
      activity.events = activity.events.filter((t) => {
        const tsMs = t.timestamp > 1_000_000_000_000 ? t.timestamp : t.timestamp * 1000;
        return tsMs > nowMs - this.deps.historyTtlMs;
      });
      if (activity.events.length === 0) this.activities.delete(key);
    }
  }

  public evaluate(): WalletCohortSignal[] {
    const candidates = this.candidates();
    const signals: WalletCohortSignal[] = [];
    const nowMs = Date.now();
    for (const sig of candidates) {
      const key = keyForSignal(sig);
      const last = this.lastEmittedAt.get(key);
      if (last !== undefined && nowMs - last < this.deps.signalCooldownMs) {
        continue;
      }
      this.lastEmittedAt.set(key, nowMs);
      signals.push(sig);
    }
    return signals;
  }

  public peek(): WalletCohortSignal[] {
    const candidates = this.candidates();
    const nowMs = Date.now();
    return candidates.filter((sig) => {
      const last = this.lastEmittedAt.get(keyForSignal(sig));
      return last === undefined || nowMs - last >= this.deps.signalCooldownMs;
    });
  }

  public activitySize(): number {
    return this.activities.size;
  }

  private candidates(): WalletCohortSignal[] {
    const signals: WalletCohortSignal[] = [];
    const nowMs = Date.now();
    signals.push(...this.evaluateConvergence(nowMs));
    signals.push(...this.evaluateRotation(nowMs));
    signals.push(...this.evaluateDormantWake(nowMs));
    return signals;
  }

  private evaluateConvergence(nowMs: number): WalletCohortSignal[] {
    const acc = new Map<string, { chain: string; symbol: string; wallets: Set<string>; totalBuyUsd: number; lastTsMs: number }>();
    for (const activity of this.activities.values()) {
      for (const t of activity.events) {
        if (t.side !== 'buy') continue;
        const tsMs = t.timestamp > 1_000_000_000_000 ? t.timestamp : t.timestamp * 1000;
        if (nowMs - tsMs > this.deps.convergenceWindowMs) continue;
        const key = `${activity.chain}:${t.tokenAddress.toLowerCase()}`;
        let line = acc.get(key);
        if (!line) {
          line = { chain: activity.chain, symbol: t.tokenSymbol, wallets: new Set(), totalBuyUsd: 0, lastTsMs: 0 };
          acc.set(key, line);
        }
        line.wallets.add(t.maker.toLowerCase());
        line.totalBuyUsd += t.amountUsd;
        if (tsMs > line.lastTsMs) line.lastTsMs = tsMs;
      }
    }

    const signals: WalletCohortSignal[] = [];
    for (const [key, line] of acc) {
      if (line.wallets.size < this.deps.minConvergenceWallets) continue;
      if (line.totalBuyUsd < this.deps.minConvergenceBuyUsd) continue;
      const tokenAddress = key.slice(key.indexOf(':') + 1);
      const score = Math.min(100, 55 + line.wallets.size * 5 + Math.round(line.totalBuyUsd / 10_000));
      signals.push({
        type: 'CONVERGENCE',
        chain: line.chain,
        tokenAddress,
        tokenSymbol: line.symbol,
        wallets: Array.from(line.wallets),
        totalBuyUsd: line.totalBuyUsd,
        score,
        note: `${line.wallets.size} smart wallets bought ${line.symbol} for $${(line.totalBuyUsd / 1000).toFixed(1)}k in the last ${Math.round(this.deps.convergenceWindowMs / 60000)}m.`,
        ts: nowMs,
      });
    }
    return signals;
  }

  private evaluateRotation(nowMs: number): WalletCohortSignal[] {
    const signals: WalletCohortSignal[] = [];
    const windowSec = this.deps.rotationWindowMs / 1000;
    for (const activity of this.activities.values()) {
      const sorted = activity.events
        .map((e) => ({ e, ts: e.timestamp > 1_000_000_000_000 ? e.timestamp / 1000 : e.timestamp }))
        .filter((x) => x.ts > nowMs / 1000 - this.deps.historyTtlMs / 1000)
        .sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < sorted.length; i += 1) {
        const sell = sorted[i]?.e;
        if (!sell || sell.side !== 'sell') continue;
        const sellTs = sorted[i].ts;
        for (let j = i + 1; j < sorted.length; j += 1) {
          const buy = sorted[j]?.e;
          if (!buy || buy.side !== 'buy' || buy.amountUsd < this.deps.rotationMinBuyUsd) continue;
          const buyTs = sorted[j].ts;
          if (buyTs - sellTs > windowSec) break;
          if (sell.tokenAddress.toLowerCase() === buy.tokenAddress.toLowerCase()) continue;
          signals.push({
            type: 'ROTATION',
            chain: activity.chain,
            soldTokenAddress: sell.tokenAddress,
            boughtTokenAddress: buy.tokenAddress,
            tokenSymbol: buy.tokenSymbol,
            wallets: [sell.maker.toLowerCase()],
            totalBuyUsd: buy.amountUsd,
            score: 70,
            note: `${sell.maker} sold ${sell.tokenSymbol} and bought ${buy.tokenSymbol} within ${Math.round(this.deps.rotationWindowMs / 60000)}m.`,
            ts: nowMs,
          });
          break;
        }
      }
    }
    return signals;
  }

  private evaluateDormantWake(nowMs: number): WalletCohortSignal[] {
    const signals: WalletCohortSignal[] = [];
    const dormantMs = this.deps.dormantWindowMs;
    for (const activity of this.activities.values()) {
      const buys = activity.events.filter((e) => e.side === 'buy');
      if (buys.length < 2) continue;
      const sorted = buys
        .map((e) => ({ e, ts: e.timestamp > 1_000_000_000_000 ? e.timestamp : e.timestamp * 1000 }))
        .sort((a, b) => a.ts - b.ts);
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      if (!latest || !prev) continue;
      if (latest.ts - prev.ts < dormantMs) continue;
      signals.push({
        type: 'DORMANT_WAKE',
        chain: activity.chain,
        tokenAddress: latest.e.tokenAddress,
        tokenSymbol: latest.e.tokenSymbol,
        wallets: [latest.e.maker.toLowerCase()],
        totalBuyUsd: latest.e.amountUsd,
        score: 55,
        note: `${latest.e.maker} returned after ${Math.round((latest.ts - prev.ts) / (24 * 60 * 60 * 1000))}d of dormancy and bought ${latest.e.tokenSymbol}.`,
        ts: nowMs,
      });
    }
    return signals;
  }
}

/**
 * Process-wide cohort tracker. Used by the polling loop in index.ts and the
 * fast-path GMGN callout webhook so push events land in the same evidence
 * history as 5-minute polled fills.
 */
export const globalWalletCohortTracker = new WalletCohortTracker();
