export type FomoResolutionMethod = 'EXACT' | 'MAJORITY' | 'AMBIGUOUS' | 'UNRESOLVED';

export interface FomoFillEvidence {
  profileId: string;
  windowStart: number;
  windowEnd: number;
  makerCandidates: string[];
  tokenAddress?: string;
  tokenSymbol?: string;
  side?: 'buy' | 'sell' | 'unknown';
  amountUsd?: number;
  txHash?: string;
}

export interface ResolvedFomoWallet {
  profileId: string;
  wallet: string | null;
  method: FomoResolutionMethod;
  confidence: number;
  hits: number;
  totalWindows: number;
  runnerUp: { wallet: string; hits: number } | null;
  lastUpdated: number;
}

interface CandidateState {
  hits: number;
  windows: Set<string>;
  lastSeen: number;
  tokens: Set<string>;
  totalUsd: number;
}

interface FomoWalletResolverDeps {
  /** Minimum weighted hits before a profile can resolve to a wallet. */
  minHits?: number;
  /** Minimum top-runner hit share vs all candidate hits. */
  minConfidence?: number;
  /** Maximum distinct candidate wallets retained per profile. */
  maxCandidatesPerProfile?: number;
  /** Ignore fills older than this. */
  historyTtlMs?: number;
}

const DEFAULT_DEPS: Required<FomoWalletResolverDeps> = {
  minHits: 3,
  minConfidence: 0.65,
  maxCandidatesPerProfile: 60,
  historyTtlMs: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Deterministic Fomo profile -> wallet resolver borrowed from the study corpus:
 * fomo-robinhood-radar resolves profiles through maker windows instead of
 * trusting one fill. Each window contributes 1 / len(makers), calm single-maker
 * windows score more, and a runner-up can still out-score an early winner.
 * It is read-only intelligence, never a signer or broadcaster.
 */
export class FomoWalletResolver {
  private readonly candidates = new Map<string, Map<string, CandidateState>>();
  private readonly profileWindowKeys = new Map<string, Set<string>>();
  private readonly deps: Required<FomoWalletResolverDeps>;

  constructor(deps: FomoWalletResolverDeps = {}) {
    this.deps = { ...DEFAULT_DEPS, ...deps };
  }

  public ingestFill(fill: FomoFillEvidence): void {
    const profileId = fill.profileId.trim().toLowerCase();
    if (!profileId) return;
    const makers = Array.from(new Set(fill.makerCandidates.map((w) => w.trim().toLowerCase()).filter(Boolean)));
    if (makers.length === 0) return;

    const nowMs = Date.now();
    if (fill.windowEnd > 0 && nowMs - fill.windowEnd > this.deps.historyTtlMs) return;

    let profileCandidates = this.candidates.get(profileId);
    if (!profileCandidates) {
      profileCandidates = new Map();
      this.candidates.set(profileId, profileCandidates);
    }

    const windowKey = `${fill.windowStart}:${fill.windowEnd}:${fill.txHash || fill.tokenAddress || 'unknown'}`;
    let seenWindows = this.profileWindowKeys.get(profileId);
    if (!seenWindows) {
      seenWindows = new Set();
      this.profileWindowKeys.set(profileId, seenWindows);
    }
    const isNewWindow = !seenWindows.has(windowKey);
    if (isNewWindow) {
      seenWindows.add(windowKey);
    }

    const weight = 1 / Math.max(1, makers.length);
    for (const maker of makers) {
      let state = profileCandidates.get(maker);
      if (!state) {
        state = { hits: 0, windows: new Set(), lastSeen: 0, tokens: new Set(), totalUsd: 0 };
        profileCandidates.set(maker, state);
      }
      state.hits += weight;
      if (isNewWindow) state.windows.add(windowKey);
      state.lastSeen = Math.max(state.lastSeen, fill.windowEnd || nowMs);
      if (fill.tokenAddress) state.tokens.add(fill.tokenAddress.toLowerCase());
      state.totalUsd += fill.amountUsd ?? 0;
    }

    if (profileCandidates.size > this.deps.maxCandidatesPerProfile) {
      const ranked = Array.from(profileCandidates.entries()).sort((a, b) => b[1].hits - a[1].hits);
      profileCandidates.clear();
      for (const [wallet, state] of ranked.slice(0, this.deps.maxCandidatesPerProfile)) {
        profileCandidates.set(wallet, state);
      }
    }
  }

  public resolve(profileId: string): ResolvedFomoWallet {
    const key = profileId.trim().toLowerCase();
    const profileCandidates = this.candidates.get(key);
    if (!profileCandidates || profileCandidates.size === 0) {
      return {
        profileId: key,
        wallet: null,
        method: 'UNRESOLVED',
        confidence: 0,
        hits: 0,
        totalWindows: 0,
        runnerUp: null,
        lastUpdated: 0,
      };
    }

    const ranked = Array.from(profileCandidates.entries())
      .map(([wallet, state]) => ({
        wallet,
        hits: state.hits,
        lastSeen: state.lastSeen,
      }))
      .sort((a, b) => b.hits - a.hits || b.lastSeen - a.lastSeen);

    const top = ranked[0];
    const runner = ranked[1] ?? null;
    const totalHits = ranked.reduce((sum, r) => sum + r.hits, 0);
    const confidence = totalHits > 0 ? top.hits / totalHits : 0;
    const totalWindows = this.profileWindowKeys.get(key)?.size ?? 0;
    const lastUpdated = top?.lastSeen ?? 0;

    if (top.hits < this.deps.minHits || confidence < this.deps.minConfidence) {
      return {
        profileId: key,
        wallet: null,
        method: top.hits > 0 ? 'AMBIGUOUS' : 'UNRESOLVED',
        confidence,
        hits: top.hits,
        totalWindows,
        runnerUp: runner ? { wallet: runner.wallet, hits: runner.hits } : null,
        lastUpdated,
      };
    }

    return {
      profileId: key,
      wallet: top.wallet,
      method: runner && Math.abs(runner.hits - top.hits) < 1e-9 ? 'AMBIGUOUS' : runner ? 'MAJORITY' : 'EXACT',
      confidence,
      hits: top.hits,
      totalWindows,
      runnerUp: runner ? { wallet: runner.wallet, hits: runner.hits } : null,
      lastUpdated,
    };
  }

  public snapshot(): Array<ResolvedFomoWallet & { candidateWallets: Array<{ wallet: string; hits: number }> }> {
    return Array.from(this.candidates.keys()).map((profileId) => {
      const res = this.resolve(profileId);
      const profileCandidates = this.candidates.get(profileId);
      const candidateWallets = profileCandidates
        ? Array.from(profileCandidates.entries())
            .map(([wallet, state]) => ({ wallet, hits: state.hits }))
            .sort((a, b) => b.hits - a.hits)
        : [];
      return {
        profileId,
        wallet: res.wallet,
        method: res.method,
        confidence: res.confidence,
        hits: res.hits,
        totalWindows: res.totalWindows,
        runnerUp: res.runnerUp,
        lastUpdated: res.lastUpdated,
        candidateWallets,
      };
    });
  }
}

/**
 * Process-wide resolver so REST push and polling loops share the same
 * profile-to-wallet evidence instead of loading separate copies.
 */
export const globalFomoWalletResolver = new FomoWalletResolver();
