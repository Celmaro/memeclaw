import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { StateStore } from '../src/services/state-store.js';
import { DecisionMemory } from '../src/services/decision-memory.js';

const dbPaths: string[] = [];
const stores: StateStore[] = [];

function tempStore(): StateStore {
  const p = path.join(process.cwd(), 'database', `test_decision_memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`);
  dbPaths.push(p);
  const s = new StateStore(p);
  stores.push(s);
  return s;
}

afterAll(() => {
  for (const s of stores) {
    try { s.flushToDisk(); } catch { /* ignore */ }
  }
  for (const p of dbPaths) {
    for (const f of [p, `${p}.tmp`]) {
      try { fs.unlinkSync(f); } catch { /* already gone */ }
    }
  }
});

describe('DecisionMemory', () => {
  it('records signal, decision, order, and journal stages under the same traceId', () => {
    const store = tempStore();
    const memory = new DecisionMemory(store);

    memory.recordSignal({
      traceId: 't1',
      source: 'gmgn-callout',
      chain: 'sol',
      tokenAddress: 'TOKEN1',
      tokenSymbol: 'CALL',
      signalScore: 81,
      rawPayloadJson: '{}',
    });
    memory.recordDecision({ traceId: 't1', decisionId: 'd1', decisionType: 'ALLOW', reason: 'gates pass' });
    memory.recordOrder({ traceId: 't1', intentId: 'i1', orderId: 'o1', orderStatus: 'PENDING', notionalUsd: 100 });
    memory.recordJournal({ traceId: 't1', journalId: 'j1' });

    const entries = memory.list();
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.stage).sort()).toEqual([
      'DECISION_MADE',
      'JOURNAL_LOGGED',
      'ORDER_SUBMITTED',
      'SIGNAL_SEEN',
    ]);
    expect(entries.filter((e) => e.traceId === 't1')).toHaveLength(4);
  });

  it('persists decision memory across StateStore reloads', () => {
    const store = tempStore();
    store.appendDecisionMemoryEntry({
      id: 'dm1',
      traceId: 't2',
      stage: 'SIGNAL_SEEN',
      source: 'tape',
      chain: 'robinhood',
      tokenAddress: '0xABCD',
      tokenSymbol: 'MOON',
      timestamp: new Date().toISOString(),
    });
    store.flushToDisk();

    const reloaded = new StateStore(dbPaths[dbPaths.length - 1]);
    stores.push(reloaded);
    expect(reloaded.getDecisionMemory()).toHaveLength(1);
    expect(reloaded.getDecisionMemory()[0].traceId).toBe('t2');
  });
});
