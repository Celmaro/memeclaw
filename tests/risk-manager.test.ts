import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../src/orchestrator/risk-engine.js';

describe('RiskEngine', () => {
  it('computes drawdown from real equity deltas', () => {
    const rm = new RiskEngine();
    rm.updateDrawdown(10000, 10000);
    expect(rm.getCurrentDrawdownPercent()).toBe(0);
    rm.updateDrawdown(9500, 10000);
    expect(rm.getCurrentDrawdownPercent()).toBeCloseTo(5, 1);
  });

  it('only tracks the worst drawdown, not rebounds', () => {
    const rm = new RiskEngine();
    rm.updateDrawdown(10000, 10000);
    rm.updateDrawdown(9000, 10000);
    rm.updateDrawdown(11000, 10000);
    expect(rm.getCurrentDrawdownPercent()).toBeCloseTo(10, 1);
  });
});
