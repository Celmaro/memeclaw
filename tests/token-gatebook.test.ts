import { describe, expect, it } from 'vitest';
import { evaluateTokenGatebook, type TokenGatebookInput } from '../src/services/token-gatebook.js';

function safeToken(over: Partial<TokenGatebookInput> = {}): TokenGatebookInput {
  return {
    chain: 'sol',
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'TEST',
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    isHoneypot: false,
    isWashTrading: false,
    taxPct: 5,
    top10HolderRate: 0.2,
    bundlerRate: 0.1,
    lpLockedPct: 0.7,
    isGraduated: true,
    devTeamHoldRate: 0.1,
    marketCapUsd: 100_000,
    volume24hUsd: 100_000,
    ...over,
  };
}

describe('TokenGatebook', () => {
  it('ALLOWs a healthy graduated token', () => {
    const result = evaluateTokenGatebook(safeToken());
    expect(result.verdict).toBe('ALLOW');
    expect(result.score).toBe(100);
    expect(result.reasons).toHaveLength(0);
  });

  it('BLOCKs when any hard gate is observed, including honeypot or ungraduated', () => {
    const honeypot = evaluateTokenGatebook(safeToken({ isHoneypot: true }));
    expect(honeypot.verdict).toBe('BLOCK');
    expect(honeypot.reasons.some((r) => r.includes('honeypot'))).toBe(true);

    const ungraduated = evaluateTokenGatebook(safeToken({ isGraduated: false }));
    expect(ungraduated.verdict).toBe('BLOCK');
    expect(ungraduated.reasons.some((r) => r.includes('bonding'))).toBe(true);
  });

  it('BLOCKs on mint authority and concentrated holders', () => {
    const mint = evaluateTokenGatebook(safeToken({ mintAuthorityActive: true }));
    expect(mint.verdict).toBe('BLOCK');
    expect(mint.reasons.some((r) => r.includes('mint'))).toBe(true);

    const concentrated = evaluateTokenGatebook(safeToken({ top10HolderRate: 0.9 }));
    expect(concentrated.verdict).toBe('BLOCK');
  });

  it('REVIEWs unknown critical fields instead of silently allowing', () => {
    const result = evaluateTokenGatebook(safeToken({
      mintAuthorityActive: undefined,
      freezeAuthorityActive: null,
      isHoneypot: null,
      taxPct: undefined,
    }));
    expect(result.verdict).toBe('REVIEW');
    expect(result.verdict).not.toBe('ALLOW');
    expect(result.reviewCount).toBeGreaterThan(0);
  });
});
