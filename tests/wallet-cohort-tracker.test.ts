import { describe, it, expect } from 'vitest';
import { WalletCohortTracker, type WalletCohortSignal } from '../src/services/wallet-cohort-tracker.js';
import type { GMGNTrackTrade, SolChain } from '../src/adapters/gmgn-adapter.js';

function trade(partial: Partial<GMGNTrackTrade> & Pick<GMGNTrackTrade, 'tokenAddress' | 'maker'>): GMGNTrackTrade {
  return {
    tokenSymbol: 'TEST',
    side: 'buy',
    amountUsd: 5_000,
    isFullClose: false,
    makerTags: [],
    timestamp: Math.floor(Date.now() / 1000),
    kind: 'smartmoney',
    ...partial,
  };
}

function signalsOfType(signals: WalletCohortSignal[], type: WalletCohortSignal['type']): WalletCohortSignal[] {
  return signals.filter((s) => s.type === type);
}

describe('WalletCohortTracker', () => {
  it('emits convergence when enough smart wallets buy the same token in a tight window', () => {
    const tracker = new WalletCohortTracker();
    const chain: SolChain = 'sol';
    const trades: GMGNTrackTrade[] = ['alice', 'bob', 'carol', 'dave'].map((maker) =>
      trade({ maker, tokenAddress: 'TOKEN_CONVERGE' })
    );
    tracker.ingest(chain, trades);

    const signals = tracker.evaluate();
    const convergence = signalsOfType(signals, 'CONVERGENCE');
    expect(convergence).toHaveLength(1);
    expect(convergence[0].tokenAddress).toBe('token_converge');
    expect(convergence[0].wallets.length).toBe(4);
    expect(convergence[0].totalBuyUsd).toBe(20_000);
  });

  it('does not emit convergence below the wallet and USD thresholds', () => {
    const tracker = new WalletCohortTracker();
    const trades: GMGNTrackTrade[] = ['alice', 'bob'].map((maker) =>
      trade({ maker, tokenAddress: 'TOKEN_TOO_QUIET', amountUsd: 1_000 })
    );
    tracker.ingest('base', trades);

    const signals = tracker.evaluate();
    expect(signalsOfType(signals, 'CONVERGENCE')).toHaveLength(0);
  });

  it('emits rotation when a wallet sells token A and buys token B within the window', () => {
    const tracker = new WalletCohortTracker();
    const now = Math.floor(Date.now() / 1000);
    tracker.ingest('robinhood', [
      trade({
        maker: '0xwallet',
        tokenAddress: '0xTOKEN_A',
        tokenSymbol: 'A',
        side: 'sell',
        amountUsd: 10_000,
        timestamp: now,
      }),
      trade({
        maker: '0xwallet',
        tokenAddress: '0xTOKEN_B',
        tokenSymbol: 'B',
        side: 'buy',
        amountUsd: 4_000,
        timestamp: now + 120,
      }),
    ]);

    const signals = tracker.evaluate();
    const rotation = signalsOfType(signals, 'ROTATION');
    expect(rotation).toHaveLength(1);
    expect(rotation[0].boughtTokenAddress).toBe('0xTOKEN_B');
    expect(rotation[0].wallets).toEqual(['0xwallet']);
  });

  it('emits dormant wake when a wallet resumes after a long inactive period', () => {
    const tracker = new WalletCohortTracker();
    const now = Math.floor(Date.now() / 1000);
    const dormantAgo = now - 12 * 24 * 60 * 60;
    tracker.ingest('sol', [
      trade({ maker: 'oldmoney', tokenAddress: 'TOKEN_OLD', amountUsd: 2_000, timestamp: dormantAgo }),
      trade({ maker: 'oldmoney', tokenAddress: 'TOKEN_NEW', amountUsd: 3_000, timestamp: now }),
    ]);

    const signals = tracker.evaluate();
    const dormant = signalsOfType(signals, 'DORMANT_WAKE');
    expect(dormant).toHaveLength(1);
    expect(dormant[0].tokenAddress).toBe('TOKEN_NEW');
  });

  it('suppresses duplicate signals within the cooldown window', () => {
    const tracker = new WalletCohortTracker();
    const trades: GMGNTrackTrade[] = ['alice', 'bob', 'carol'].map((maker) =>
      trade({ maker, tokenAddress: 'TOKEN_COOLDOWN' })
    );
    tracker.ingest('sol', trades);

    expect(signalsOfType(tracker.evaluate(), 'CONVERGENCE')).toHaveLength(1);
    expect(signalsOfType(tracker.evaluate(), 'CONVERGENCE')).toHaveLength(0);
  });

  it('peek exposes signals without consuming the cooldown', () => {
    const tracker = new WalletCohortTracker();
    const trades: GMGNTrackTrade[] = ['alice', 'bob', 'carol'].map((maker) =>
      trade({ maker, tokenAddress: 'TOKEN_PEEK' })
    );
    tracker.ingest('sol', trades);

    expect(signalsOfType(tracker.peek(), 'CONVERGENCE')).toHaveLength(1);
    expect(signalsOfType(tracker.evaluate(), 'CONVERGENCE')).toHaveLength(1);
    expect(signalsOfType(tracker.peek(), 'CONVERGENCE')).toHaveLength(0);
  });
});
