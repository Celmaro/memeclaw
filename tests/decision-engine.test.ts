import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../src/orchestrator/risk-engine.js';
import { compileExecutionVerdict } from '../src/orchestrator/decision-engine.js';
import type { ApprovedOrderIntent } from '../src/domain/order-intent.js';
import type { RiskDecision } from '../src/domain/risk-decision.js';

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

const allowDecision: RiskDecision = {
  decisionId: 'r1',
  decisionType: 'ALLOW',
  reason: 'all deterministic gates passed',
  policyVersion: '1.0.0',
  decidedBy: 'algorithm',
  gates: { liquidityUsd: 50_000, volume1hUsd: 10_000 },
};

describe('decision engine', () => {
  it('returns EXECUTABLE only when intent, decision, risk manager, and kill switch all pass', () => {
    const verdict = compileExecutionVerdict({
      intent: baseIntent,
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });

    expect(verdict).toEqual({
      verdict: 'EXECUTABLE',
      intentId: 'i1',
      decisionId: 'r1',
      policyVersion: '1.0.0',
      notionalUsd: 100,
    });
  });

  it('blocks PAPER_ONLY and REJECT decisions before any execution concern', () => {
    const verdict = compileExecutionVerdict({
      intent: baseIntent,
      decision: { ...allowDecision, decisionType: 'PAPER_ONLY' },
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });

    expect(verdict.verdict).toBe('BLOCKED');
    if (verdict.verdict === 'BLOCKED') {
      expect(verdict.reason).toContain('not ALLOW');
    }
  });

  it('blocks when risk manager size gate rejects the intent amount', () => {
    const verdict = compileExecutionVerdict({
      intent: { ...baseIntent, notionalUsd: 1000 },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });

    expect(verdict.verdict).toBe('BLOCKED');
    if (verdict.verdict === 'BLOCKED') {
      expect(verdict.reason).toContain('max allowed trade size');
    }
  });

  it('blocks when the kill switch is active even if every other gate passes', () => {
    const killSwitch = new RiskEngine();
    killSwitch.activateKillSwitch('manual test');

    const verdict = compileExecutionVerdict({
      intent: baseIntent,
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch,
    });

    expect(verdict.verdict).toBe('BLOCKED');
    if (verdict.verdict === 'BLOCKED') {
      expect(verdict.reason).toContain('kill switch');
    }
  });

  it('blocks expired decisions and invalid intents fail closed', () => {
    const expired = compileExecutionVerdict({
      intent: baseIntent,
      decision: {
        ...allowDecision,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(expired.verdict).toBe('BLOCKED');

    const invalid = compileExecutionVerdict({
      intent: { ...baseIntent, idempotencyKey: '' },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(invalid.verdict).toBe('BLOCKED');
    if (invalid.verdict === 'BLOCKED') {
      expect(invalid.reason).toContain('intent validation');
    }
  });

  it('blocks when the token gatebook does not allow execution', () => {
    const verdict = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        tokenGatebook: {
          chain: 'sol',
          address: 'So11111111111111111111111111111111111111112',
          isHoneypot: true,
        },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });

    expect(verdict.verdict).toBe('BLOCKED');
    if (verdict.verdict === 'BLOCKED') {
      expect(verdict.reason).toContain('token gatebook');
    }
  });

  it('blocks BUY when launch intelligence is RISK, STALLED, or UNKNOWN', () => {
    const risk = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        launchIntelligence: {
          chain: 'sol',
          address: baseIntent.tokenAddress,
          symbol: 'BOT',
          curveProgress: 0.9,
          createdAt: '2026-09-17T00:00:00.000Z',
          observedAt: '2026-09-17T00:01:00.000Z',
          graduated: false,
          holderCount: 300,
          buyVolumeUsd: 90_000,
          devHoldingPct: 0.1,
          bundleRate: 0.1,
        },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(risk.verdict).toBe('BLOCKED');
    if (risk.verdict === 'BLOCKED') expect(risk.reason).toContain('launch intelligence RISK');

    const stalled = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        launchIntelligence: {
          chain: 'sol',
          address: baseIntent.tokenAddress,
          symbol: 'STUCK',
          curveProgress: 0.2,
          createdAt: '2026-09-17T00:00:00.000Z',
          observedAt: '2026-09-17T05:00:00.000Z',
          graduated: false,
          bundleRate: 0.1,
        },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(stalled.verdict).toBe('BLOCKED');

    const unknown = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        launchIntelligence: { chain: 'sol', address: baseIntent.tokenAddress, symbol: 'GHOST' },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(unknown.verdict).toBe('BLOCKED');
  });

  it('allows BUY when launch intelligence is HEALTHY or SLOW', () => {
    const healthy = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        launchIntelligence: {
          chain: 'sol',
          address: baseIntent.tokenAddress,
          symbol: 'OK',
          curveProgress: 0.9,
          createdAt: '2026-09-17T00:00:00.000Z',
          observedAt: '2026-09-17T03:00:00.000Z',
          holderCount: 500,
          buyVolumeUsd: 120_000,
          graduated: true,
          devHoldingPct: 0.1,
          bundleRate: 0.1,
        },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(healthy.verdict).toBe('EXECUTABLE');

    const slow = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        launchIntelligence: {
          chain: 'sol',
          address: baseIntent.tokenAddress,
          symbol: 'SLOW',
          curveProgress: 0.1,
          createdAt: '2026-09-17T00:00:00.000Z',
          observedAt: '2026-09-17T00:05:00.000Z',
          holderCount: 120,
          buyVolumeUsd: 25_000,
          graduated: false,
          devHoldingPct: 0.2,
          bundleRate: 0.1,
        },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(slow.verdict).toBe('EXECUTABLE');
  });

  it('blocks SELL when exit safety hard-blocks the quote', () => {
    const verdict = compileExecutionVerdict({
      intent: {
        ...baseIntent,
        side: 'SELL',
        exitSafety: {
          chain: 'robinhood',
          tokenAddress: baseIntent.tokenAddress,
          symbol: 'BAD',
          priceUsd: 1,
          positionAmount: 1000,
          liquidityUsd: 100_000,
          sellTax: 3,
          canNotSell: true,
          isHoneypot: null,
        },
      },
      decision: allowDecision,
      riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
      killSwitch: new RiskEngine(),
    });
    expect(verdict.verdict).toBe('BLOCKED');
    if (verdict.verdict === 'BLOCKED') expect(verdict.reason).toContain('exit safety');
  });

  it('allows SELL when exit safety returns CLEAR or only warns', () => {
    const sellIntent: ApprovedOrderIntent = {
      ...baseIntent,
      side: 'SELL',
      exitSafety: {
        chain: 'robinhood',
        tokenAddress: baseIntent.tokenAddress,
        symbol: 'OK',
        priceUsd: 1,
        positionAmount: 100,
        liquidityUsd: 150_000,
        volume24hUsd: 100_000,
        sellTax: 3,
        buyTax: 3,
        canNotSell: false,
        isHoneypot: false,
        creatorClose: false,
        bundlerRate: 0.1,
        rugRatio: 0.1,
      },
    };
    expect(
      compileExecutionVerdict({
        intent: sellIntent,
        decision: allowDecision,
        riskManager: new RiskEngine({ maxTradeAmountUsd: 500 }),
        killSwitch: new RiskEngine(),
      }).verdict
    ).toBe('EXECUTABLE');
  });
});

