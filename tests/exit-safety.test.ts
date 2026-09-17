import { describe, expect, it } from 'vitest';
import { evaluateExitSafety } from '../src/services/exit-safety.js';

const base = {
  chain: 'sol',
  tokenAddress: 'SoExitPilot',
  symbol: 'PILOT',
  priceUsd: 1,
  positionAmount: 1000,
  amountFraction: 1,
  liquidityUsd: 100_000,
  volume24hUsd: 100_000,
  sellTax: 3,
  buyTax: 3,
  canNotSell: false,
  isHoneypot: false,
  creatorClose: false,
  creatorTokenStatus: null,
  bundlerRate: 0.1,
  rugRatio: 0.1,
  top10HolderRate: 0.2,
  smartDegenCount: 10,
  priceChange1h: 5,
};

describe('exit safety', () => {
  it('returns CLEAR with an exit quote for a healthy token', () => {
    const result = evaluateExitSafety({ ...base });
    expect(result.verdict).toBe('CLEAR');
    expect(result.quote?.quoteUsd).toBe(1000);
    expect(result.quote?.estimatedProceedsUsd).toBeGreaterThan(900);
    expect(result.passedChecks).toBeGreaterThan(0);
  });

  it('hard blocks a token that cannot be sold', () => {
    const result = evaluateExitSafety({ ...base, canNotSell: true, isHoneypot: null });
    expect(result.verdict).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('cannot be sold'))).toBe(true);
  });

  it('hard blocks on a confirmed honeypot', () => {
    const result = evaluateExitSafety({ ...base, isHoneypot: true });
    expect(result.verdict).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('honeypot'))).toBe(true);
  });

  it('hard blocks when bundler rate is above policy', () => {
    const result = evaluateExitSafety({ ...base, bundlerRate: 0.95 });
    expect(result.verdict).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('bundler'))).toBe(true);
  });

  it('hard blocks when rug ratio is above policy', () => {
    const result = evaluateExitSafety({ ...base, rugRatio: 0.9 });
    expect(result.verdict).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('rug'))).toBe(true);
  });

  it('hard blocks launch bundle and sniper evidence', () => {
    const bundle = evaluateExitSafety({ ...base, bundleWave: 12 });
    expect(bundle.verdict).toBe('BLOCK');
    const sniper = evaluateExitSafety({ ...base, sniperBuy: true });
    expect(sniper.verdict).toBe('BLOCK');
  });

  it('warns on shallow or unknown depth', () => {
    const shallow = evaluateExitSafety({ ...base, liquidityUsd: 5_000 });
    expect(shallow.verdict).toBe('WARN');
    const unknown = evaluateExitSafety({ ...base, liquidityUsd: null });
    expect(unknown.verdict).toBe('WARN');
  });
});
