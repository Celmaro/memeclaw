import { describe, expect, it } from 'vitest';
import { FomoWalletResolver, type FomoFillEvidence } from '../src/services/fomo-wallet-resolver.js';

function fill(over: Partial<FomoFillEvidence>): FomoFillEvidence {
  const now = Date.now();
  return {
    profileId: 'trader_alpha',
    windowStart: now - 30_000,
    windowEnd: now,
    makerCandidates: ['0xaaa'],
    tokenAddress: '0xpitoken',
    side: 'buy',
    amountUsd: 1000,
    ...over,
  };
}

describe('FomoWalletResolver', () => {
  it('resolves a profile after calm single-maker windows', () => {
    const resolver = new FomoWalletResolver({ minHits: 3, minConfidence: 0.65 });
    resolver.ingestFill(fill({ txHash: 'tx1' }));
    resolver.ingestFill(fill({ txHash: 'tx2' }));
    resolver.ingestFill(fill({ txHash: 'tx3' }));

    const res = resolver.resolve('trader_alpha');
    expect(res.wallet).toBe('0xaaa');
    expect(res.hits).toBe(3);
    expect(res.method).toBe('EXACT');
    expect(res.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it('uses majority confidence from noisy windows', () => {
    const resolver = new FomoWalletResolver({ minHits: 3, minConfidence: 0.65 });
    for (let i = 0; i < 4; i += 1) {
      resolver.ingestFill(fill({ txHash: `tx${i}` }));
    }
    resolver.ingestFill(fill({ txHash: 'noisy', makerCandidates: ['0xaaa', '0xbbb'] }));

    const res = resolver.resolve('trader_alpha');
    expect(res.wallet).toBe('0xaaa');
    expect(res.method).toBe('MAJORITY');
    expect(res.confidence).toBeGreaterThan(0.7);
  });

  it('returns AMBIGUOUS when no wallet clears the confidence bar', () => {
    const resolver = new FomoWalletResolver({ minHits: 3, minConfidence: 0.65 });
    resolver.ingestFill(fill({ txHash: 't1', makerCandidates: ['0xaaa'] }));
    resolver.ingestFill(fill({ txHash: 't2', makerCandidates: ['0xbbb'] }));
    resolver.ingestFill(fill({ txHash: 't3', makerCandidates: ['0xccc'] }));

    const res = resolver.resolve('trader_alpha');
    expect(res.wallet).toBeNull();
    expect(res.method).toBe('AMBIGUOUS');
    expect(res.runnerUp).not.toBeNull();
  });

  it('returns UNRESOLVED for unknown profiles', () => {
    const resolver = new FomoWalletResolver();
    const res = resolver.resolve('ghost');
    expect(res.wallet).toBeNull();
    expect(res.method).toBe('UNRESOLVED');
  });
});
