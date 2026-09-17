import { describe, expect, it } from 'vitest';
import { SmartMoneyWalletScorer, type SmartWalletTrade } from '../src/services/smart-money-wallet-scorer.js';

function trade(part: Partial<SmartWalletTrade> & { realizedPnlUsd: number }): SmartWalletTrade {
  return {
    side: 'buy',
    tokenAddress: part.tokenAddress ?? '0xunknown',
    tokenSymbol: part.tokenSymbol,
    amountUsd: 1000,
    realizedPnlUsd: part.realizedPnlUsd,
    holdDurationMs: part.holdDurationMs ?? 7 * 60 * 1000,
    timestamp: part.timestamp,
  };
}

describe('SmartMoneyWalletScorer', () => {
  it('gives FIRE grade to a proven profitable wallet', () => {
    const scorer = new SmartMoneyWalletScorer();
    const scored = scorer.score({
      wallet: '0xPRO',
      chain: 'robinhood',
      trades: [
        trade({ tokenAddress: '0xa', realizedPnlUsd: 500 }),
        trade({ tokenAddress: '0xa', realizedPnlUsd: 300 }),
        trade({ tokenAddress: '0xb', realizedPnlUsd: 100 }),
        trade({ tokenAddress: '0xb', realizedPnlUsd: -50 }),
        trade({ tokenAddress: '0xc', realizedPnlUsd: 200 }),
        trade({ tokenAddress: '0xc', realizedPnlUsd: 120 }),
      ],
    });

    expect(scored.grade).toBe('FIRE');
    expect(scored.score).toBeGreaterThanOrEqual(70);
    expect(scored.detail.winCount).toBe(5);
    expect(scored.detail.lossCount).toBe(1);
    expect(scored.detail.wilsonWinRate).toBeGreaterThan(0.5);
  });

  it('gives NOISE to weak evidence and refuses bot-like rotations', () => {
    const scorer = new SmartMoneyWalletScorer();
    const scored = scorer.score({
      wallet: '0xb0t',
      chain: 'sol',
      trades: [
        trade({ tokenAddress: '0xa', realizedPnlUsd: -10 }),
        trade({ tokenAddress: '0xa', realizedPnlUsd: -12 }),
        trade({ tokenAddress: '0xa', realizedPnlUsd: -8 }),
        trade({ tokenAddress: '0xa', realizedPnlUsd: -15 }),
        trade({ tokenAddress: '0xa', realizedPnlUsd: -6 }),
        trade({ tokenAddress: '0xa', realizedPnlUsd: -9 }),
      ],
    });

    expect(scored.grade).not.toBe('FIRE');
    expect(scored.detail.redFlags.some((f) => f.includes('bot_like_inventory_rotation'))).toBe(true);
  });

  it('returns UNKNOWN when there is no trade evidence', () => {
    const scorer = new SmartMoneyWalletScorer();
    const scored = scorer.score({ wallet: '0xnew', chain: 'base' });
    expect(scored.grade).toBe('UNKNOWN');
    expect(scored.score).toBe(0);
  });
});
