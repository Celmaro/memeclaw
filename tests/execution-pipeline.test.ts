import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../src/orchestrator/risk-engine.js';
import { ExecutionPipeline } from '../src/orchestrator/execution-pipeline.js';
import type { ApprovedOrderIntent } from '../src/domain/order-intent.js';
import type { RiskDecision } from '../src/domain/risk-decision.js';

const baseIntent: ApprovedOrderIntent = {
  schemaVersion: 1,
  intentId: 'intent_1',
  traceId: 'trace_1',
  chain: 'robinhood',
  venue: 'evmswap',
  tokenAddress: '0x0000000000000000000000000000000000000000',
  side: 'BUY',
  notionalUsd: 120,
  minOut: 0,
  slippageBps: 150,
  expirationAt: new Date(Date.now() + 60_000).toISOString(),
  riskDecisionId: 'decision_1',
  policyVersion: 'memecoin-only-2026.09.16',
  idempotencyKey: 'idem_1',
};

const allowDecision: RiskDecision = {
  decisionId: 'decision_1',
  decisionType: 'ALLOW',
  reason: 'deterministic gates passed',
  policyVersion: 'memecoin-only-2026.09.16',
  decidedBy: 'algorithm',
  gates: { liquidityUsd: 50_000 },
};

describe('execution pipeline', () => {
  it('submits an executable intent and records it as PENDING', () => {
    const pipeline = new ExecutionPipeline();
    const result = pipeline.submit({ intent: baseIntent, decision: allowDecision, riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }), killSwitch: new RiskEngine() });
    expect(result.ok).toBe(true);
    expect(result.order?.status).toBe('PENDING');
    expect(pipeline.listOpenOrders()).toHaveLength(1);
  });

  it('rejects duplicate idempotency keys', () => {
    const pipeline = new ExecutionPipeline();
    pipeline.submit({ intent: baseIntent, decision: allowDecision, riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }), killSwitch: new RiskEngine() });
    const duplicate = pipeline.submit({ intent: { ...baseIntent, intentId: 'intent_2' }, decision: allowDecision, riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }), killSwitch: new RiskEngine() });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.error).toContain('Duplicate idempotency key');
    expect(duplicate.order?.status).toBe('PENDING');
  });

  it('records a FAILED order when the decision engine blocks', () => {
    const pipeline = new ExecutionPipeline();
    const killSwitch = new RiskEngine();
    killSwitch.activateKillSwitch('test kill');
    const result = pipeline.submit({ intent: baseIntent, decision: allowDecision, riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }), killSwitch });
    expect(result.ok).toBe(false);
    expect(result.order?.status).toBe('FAILED');
    expect(result.order?.failureReason).toContain('kill switch');
  });

  it('tracks simulated then filled lifecycle', () => {
    const pipeline = new ExecutionPipeline();
    pipeline.submit({ intent: baseIntent, decision: allowDecision, riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }), killSwitch: new RiskEngine() });
    expect(pipeline.markSimulated('intent_1', '0xsim_tx')?.status).toBe('SIMULATED');
    const filled = pipeline.markFilled('intent_1', '0xreal_tx', 118);
    expect(filled?.status).toBe('FILLED');
    expect(filled?.filledNotionalUsd).toBe(118);
    expect(pipeline.listOpenOrders()).toHaveLength(0);
  });

  it('supports partial fill then cancellation', () => {
    const pipeline = new ExecutionPipeline();
    pipeline.submit({ intent: baseIntent, decision: allowDecision, riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }), killSwitch: new RiskEngine() });
    expect(pipeline.markPartialFill('intent_1', '0xpartial', 50)?.status).toBe('PARTIAL_FILL');
    expect(pipeline.markCancelled('intent_1')?.status).toBe('CANCELLED');
    expect(pipeline.listOpenOrders()).toHaveLength(0);
  });

  it('writes order lifecycle events to decision memory hooks', () => {
    const calls: Array<{ kind: string; stage?: string; orderStatus?: string; traceId?: string }> = [];
    const memory = {
      recordOrder(input: { traceId: string; orderStatus: string }) {
        calls.push({ kind: 'order', orderStatus: input.orderStatus, traceId: input.traceId });
      },
      recordOrderOutcome(input: { traceId: string; stage: 'ORDER_FILLED' | 'ORDER_CANCELLED' | 'ORDER_FAILED'; orderStatus: string }) {
        calls.push({ kind: 'outcome', stage: input.stage, orderStatus: input.orderStatus, traceId: input.traceId });
      },
    };

    let pipeline = new ExecutionPipeline(memory);
    const killSwitch = new RiskEngine();
    killSwitch.activateKillSwitch('block for memory test');
    pipeline.submit({
      intent: { ...baseIntent, intentId: 'intent_blocked', traceId: 'trace_blocked' },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ kind: 'outcome', stage: 'ORDER_FAILED', traceId: 'trace_blocked' });

    calls.length = 0;
    pipeline = new ExecutionPipeline(memory);
    pipeline.submit({
      intent: { ...baseIntent, intentId: 'intent_ok', traceId: 'trace_ok' },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    pipeline.markSimulated('intent_ok', '0xsim_tx');
    pipeline.markFilled('intent_ok', '0xfill_tx', 110);

    expect(calls.map((c) => c.orderStatus)).toEqual(['PENDING', 'SIMULATED', 'FILLED']);
    expect(calls[2]).toMatchObject({ kind: 'outcome', stage: 'ORDER_FILLED', traceId: 'trace_ok' });
  });
});

