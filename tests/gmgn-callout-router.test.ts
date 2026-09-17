import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import { GMGNCalloutRouter } from '../src/services/gmgn-callout-router.js';
import { StateStore } from '../src/services/state-store.js';
import { WalletCohortTracker } from '../src/services/wallet-cohort-tracker.js';

const tmpPaths: string[] = [];
const tmpStores: StateStore[] = [];

afterAll(() => {
  for (const s of tmpStores) {
    try { s.flushToDisk(); } catch { /* ignore */ }
  }
  for (const p of tmpPaths) {
    for (const f of [p, `${p}.tmp`]) {
      try { fs.unlinkSync(f); } catch { /* already gone */ }
    }
  }
});

describe('GMGNCalloutRouter', () => {
  it('normalizes a GMGN track-trade webhook into an event envelope', () => {
    const router = new GMGNCalloutRouter();
    const callout = router.ingest({
      event: 'TRACK_TRADE',
      chain: 'sol',
      data: {
        token_address: 'TOKEN_CALL',
        symbol: 'CALL',
        side: 'buy',
        maker: 'wallet1',
        amount_usd: 1234,
        tx_hash: 'tx123',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    expect(callout.chain).toBe('sol');
    expect(callout.tokenAddress).toBe('token_call');
    expect(callout.side).toBe('buy');
    expect(callout.amountUsd).toBe(1234);
    expect(callout.envelope.source).toBe('gmgn-callout');
    expect(callout.envelope.kind).toBe('track_trade');
    expect(callout.envelope.context.txHash).toBe('tx123');
  });

  it('de-duplicates identical webhook payloads', () => {
    const router = new GMGNCalloutRouter();
    const raw = {
      event: 'TOKEN_SIGNAL',
      chain: 'base',
      data: { token_address: '0xABC', symbol: 'BASE_MEME', timestamp: 1_700_000_000 },
    };
    router.ingest(raw);
    router.ingest(raw);

    expect(router.recentEvents()).toHaveLength(1);
  });

  it('marks unknown chains as null but keeps a conservative default in the envelope', () => {
    const router = new GMGNCalloutRouter();
    const callout = router.ingest({
      event: 'TOKEN_SIGNAL',
      data: { token_address: '0xunknown', symbol: 'X' },
    });

    expect(callout.chain).toBeNull();
    expect(callout.envelope.context.chain).toBe('sol');
  });

  it('persists first-time callouts to the state store and de-duplicates restarts', () => {
    const dbPath = `database/test_gmgn_callout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`;
    tmpPaths.push(dbPath);
    const store = new StateStore(dbPath);
    tmpStores.push(store);
    const router = new GMGNCalloutRouter({ stateStore: store });
    const raw = {
      event: 'TRACK_TRADE',
      chain: 'base',
      data: {
        token_address: '0xPERSIST',
        symbol: 'PERSIST',
        side: 'buy',
        maker: 'wallet_persist',
        amount_usd: 50,
        tx_hash: 'tx_persist',
        timestamp: Math.floor(Date.now() / 1000),
      },
    };

    const first = router.ingest(raw);
    expect(first.duplicate).toBe(false);
    expect(store.getCalloutLedger()).toHaveLength(1);
    expect(store.getAllDedupEntries()[first.envelope.dedupeKey]).toBeGreaterThan(0);

    const second = router.ingest(raw);
    expect(second.duplicate).toBe(true);
    expect(store.getCalloutLedger()).toHaveLength(1);
  });

  it('feeds callout fills into the wallet cohort tracker for evidence accumulation', () => {
    const cohort = new WalletCohortTracker();
    const router = new GMGNCalloutRouter({ walletCohort: cohort });
    router.ingest({
      event: 'TRACK_TRADE',
      chain: 'robinhood',
      data: {
        token_address: '0xCOHORT',
        symbol: 'COHORT',
        side: 'buy',
        maker: 'wallet_cohort',
        amount_usd: 500,
        tx_hash: 'tx_cohort',
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    expect(cohort.activitySize()).toBe(1);
  });
});
