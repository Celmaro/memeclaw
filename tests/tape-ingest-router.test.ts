import { describe, expect, it, afterAll } from 'vitest';
import fs from 'fs';
import { TapeIngestRouter } from '../src/services/tape-ingest-router.js';
import { StateStore } from '../src/services/state-store.js';
import { DecisionMemory } from '../src/services/decision-memory.js';
import { FomoWalletResolver } from '../src/services/fomo-wallet-resolver.js';
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

function tapePayload(over: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    network: 'FOMO',
    pair: {
      chainId: 5318008,
      dexId: 'uniswapv3',
      baseToken: { address: '0xROUTER', symbol: 'ROUTER' },
    },
    trade: {
      side: 'BUY',
      amountUsd: 777,
      maker: '0xwalletrouter',
      txHash: `tx_router_${now}`,
      timestamp: Math.floor(now / 1000),
    },
    ...over,
  };
}

describe('TapeIngestRouter', () => {
  it('persists first-time tape events and marks duplicates', () => {
    const dbPath = `database/test_tape_router_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`;
    tmpPaths.push(dbPath);
    const store = new StateStore(dbPath);
    tmpStores.push(store);
    const memory = new DecisionMemory(store);
    const router = new TapeIngestRouter({ stateStore: store, decisionMemory: memory });
    const raw = tapePayload();

    const first = router.ingest(raw, { source: 'tape-robinhood', chain: 'robinhood' });
    expect(first.success).toBe(true);
    expect(first.duplicate).toBe(false);
    expect(first.stored).toBe(true);
    expect(store.getCalloutLedger()).toHaveLength(1);
    expect(store.getDecisionMemory()).toHaveLength(1);

    const second = router.ingest(raw, { source: 'tape-robinhood', chain: 'robinhood' });
    expect(second.duplicate).toBe(true);
    expect(store.getCalloutLedger()).toHaveLength(1);
    expect(store.getDecisionMemory()).toHaveLength(1);
  });

  it('returns failure for malformed tape', () => {
    const router = new TapeIngestRouter();
    const result = router.ingest({ raw: 'garbage' }, { chain: 'robinhood' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('feeds fomo profile resolution when the push carries maker windows', () => {
    const resolver = new FomoWalletResolver({ minHits: 3, minConfidence: 0.65 });
    const router = new TapeIngestRouter({ fomoResolver: resolver });
    const profileId = 'profile_router';
    const now = Date.now();

    for (let i = 0; i < 3; i += 1) {
      router.ingest(
        tapePayload({
          profileId,
          windowStart: now - 30_000,
          windowEnd: now,
          makerCandidates: ['0xprofilewallet'],
          trade: {
            side: 'BUY',
            amountUsd: 500,
            maker: '0xprofilewallet',
            txHash: `profile_tx_${i}`,
            timestamp: Math.floor(now / 1000),
          },
        }),
        { chain: 'robinhood' }
      );
    }

    const res = resolver.resolve(profileId);
    expect(res.wallet).toBe('0xprofilewallet');
    expect(res.method).toBe('EXACT');
  });

  it('feeds wallet cohort evidence for buy/sell tape', () => {
    const cohort = new WalletCohortTracker();
    const router = new TapeIngestRouter({ walletCohort: cohort });
    router.ingest(tapePayload(), { source: 'tape-robinhood', chain: 'robinhood' });

    expect(cohort.activitySize()).toBe(1);
  });
});
