export interface SourceHealthSnapshot {
  source: string;
  lastSeenAt: number | null;
  lastErrorAt: number | null;
  consecutiveErrors: number;
  lastError?: string;
}

export type SourceStatus = 'healthy' | 'stale' | 'degraded';

export class SourceHealthTracker {
  private readonly state = new Map<string, SourceHealthSnapshot>();

  public recordSuccess(source: string, at = Date.now()): SourceHealthSnapshot {
    const next: SourceHealthSnapshot = {
      source,
      lastSeenAt: at,
      lastErrorAt: null,
      consecutiveErrors: 0,
      lastError: undefined,
    };
    this.state.set(source, next);
    return next;
  }

  public recordFailure(source: string, error?: unknown, at = Date.now()): SourceHealthSnapshot {
    const prev = this.state.get(source) ?? {
      source,
      lastSeenAt: null,
      lastErrorAt: null,
      consecutiveErrors: 0,
    };
    const next: SourceHealthSnapshot = {
      source,
      lastSeenAt: prev.lastSeenAt,
      lastErrorAt: at,
      consecutiveErrors: prev.consecutiveErrors + 1,
      lastError: error instanceof Error ? error.message : String(error ?? 'unknown error'),
    };
    this.state.set(source, next);
    return next;
  }

  public snapshot(source: string): SourceHealthSnapshot {
    return (
      this.state.get(source) ?? {
        source,
        lastSeenAt: null,
        lastErrorAt: null,
        consecutiveErrors: 0,
      }
    );
  }

  public status(source: string, opts: { staleAfterMs: number; maxConsecutiveErrors?: number }): SourceStatus {
    const snap = this.snapshot(source);
    if (!snap.lastSeenAt || Date.now() - snap.lastSeenAt > opts.staleAfterMs) return 'stale';
    if (opts.maxConsecutiveErrors !== undefined && snap.consecutiveErrors >= opts.maxConsecutiveErrors) return 'degraded';
    return 'healthy';
  }
}
