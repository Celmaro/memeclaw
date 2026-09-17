import { describe, it, expect } from 'vitest';
import {
  createEventEnvelope,
  buildEventDedupeKey,
  isEventStale,
} from '../src/domain/event-envelope.js';
import { SourceHealthTracker } from '../src/domain/source-health.js';
import { validateOrderIntent, type ApprovedOrderIntent } from '../src/domain/order-intent.js';
import { isExecutableDecision, type RiskDecision } from '../src/domain/risk-decision.js';

describe('event envelope', () => {
  it('builds a deterministic dedupe key from source, chain, tx hash and payload', () => {
    const base = {
      source: 'gmgn',
      kind: 'wallet_trade',
      context: { chain: 'sol' as const, txHash: 'abc' },
      occurredAt: '2026-09-16T00:00:00.000Z',
      payload: { side: 'buy' },
    };
    expect(buildEventDedupeKey(base)).toBe(buildEventDedupeKey(base));
    expect(buildEventDedupeKey({ ...base, payload: { side: 'sell' } })).not.toBe(
      buildEventDedupeKey(base)
    );
  });

  it('createEventEnvelope emits schemaVersion 1 and an eventId', () => {
    const event = createEventEnvelope({
      traceId: 't1',
      source: 'dexscreener',
      kind: 'pair',
      context: { chain: 'base' },
      payload: { symbol: 'PEPE' },
    });
    expect(event.schemaVersion).toBe(1);
    expect(event.eventId).toBeTruthy();
    expect(event.dedupeKey).toContain('dexscreener:base:pair');
  });

  it('marks old or malformed events as stale', () => {
    expect(isEventStale({ occurredAt: new Date(Date.now() - 61_000).toISOString() }, 60_000)).toBe(true);
    expect(isEventStale({ occurredAt: new Date().toISOString() }, 60_000)).toBe(false);
    expect(isEventStale({ occurredAt: 'garbage' }, 60_000)).toBe(true);
  });
});

describe('source health tracker', () => {
  it('starts stale, becomes healthy after a success, and degrades after repeated failures', () => {
    const tracker = new SourceHealthTracker();
    expect(tracker.status('gmgn', { staleAfterMs: 1000 })).toBe('stale');
    tracker.recordSuccess('gmgn', Date.now());
    expect(tracker.status('gmgn', { staleAfterMs: 1000, maxConsecutiveErrors: 2 })).toBe('healthy');
    tracker.recordFailure('gmgn', new Error('rate limited'));
    expect(tracker.status('gmgn', { staleAfterMs: 1000, maxConsecutiveErrors: 2 })).toBe('healthy');
    tracker.recordFailure('gmgn', new Error('rate limited'));
    expect(tracker.status('gmgn', { staleAfterMs: 1000, maxConsecutiveErrors: 2 })).toBe('degraded');
  });
});

describe('approved order intent', () => {
  const baseIntent: ApprovedOrderIntent = {
    schemaVersion: 1,
    intentId: 'i1',
    traceId: 't1',
    chain: 'sol',
    venue: 'jupiter',
    tokenAddress: 'So11111111111111111111111111111111111111112',
    side: 'BUY',
    notionalUsd: 100,
    minOut: 95,
    slippageBps: 500,
    expirationAt: new Date(Date.now() + 60_000).toISOString(),
    riskDecisionId: 'r1',
    policyVersion: '1.0.0',
    idempotencyKey: 'idem-1',
  };

  it('accepts a valid intent', () => {
    expect(validateOrderIntent(baseIntent)).toEqual({ ok: true, errors: [] });
  });

  it('rejects missing safety fields', () => {
    const result = validateOrderIntent({
      ...baseIntent,
      notionalUsd: 0,
      expirationAt: new Date(Date.now() - 60_000).toISOString(),
      idempotencyKey: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain('notionalUsd must be a positive number');
      expect(result.errors).toContain('expirationAt must be a future ISO timestamp');
      expect(result.errors).toContain('idempotencyKey is required');
    }
  });
});

describe('risk decision', () => {
  const allow: RiskDecision = {
    decisionId: 'd1',
    decisionType: 'ALLOW',
    reason: 'all gates passed',
    policyVersion: '1.0.0',
    decidedBy: 'algorithm',
    gates: { liquidityUsd: 50000 },
  };

  it('only executable when decision is ALLOW and not expired', () => {
    expect(isExecutableDecision(allow)).toBe(true);
    expect(
      isExecutableDecision({ ...allow, decisionType: 'PAPER_ONLY' })
    ).toBe(false);
    expect(
      isExecutableDecision({
        ...allow,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      })
    ).toBe(false);
  });
});
