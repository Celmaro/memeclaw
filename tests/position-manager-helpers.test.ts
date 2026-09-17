import { describe, it, expect } from 'vitest';
import { PositionManager } from '../src/position/position-manager.js';

describe('position manager exit helpers', () => {
  it('marks TP milestones so exit manager does not re-emit the same take-profit', () => {
    const pm = new PositionManager();
    pm.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
    });

    pm.markTpTriggered('tok1', 'tp100Triggered');
    pm.markTpTriggered('tok1', 'tp200Triggered');

    const pos = pm.getPosition('tok1');
    expect(pos?.tp100Triggered).toBe(true);
    expect(pos?.tp200Triggered).toBe(true);
  });

  it('scales a position amount after a partial exit and updates current price', () => {
    const pm = new PositionManager();
    pm.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
    });

    const updated = pm.scalePositionAmount('tok1', 0.5, 2.1);
    expect(updated?.amount).toBe(500);
    expect(updated?.currentPriceUsd).toBe(2.1);
    expect(pm.getPosition('tok1')?.amount).toBe(500);
  });

  it('does not scale a missing or invalid position', () => {
    const pm = new PositionManager();
    expect(pm.scalePositionAmount('missing', 0.5)).toBeUndefined();

    pm.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
    });
    expect(pm.scalePositionAmount('tok1', 0)).toBeUndefined();
    expect(pm.scalePositionAmount('tok1', NaN)).toBeUndefined();
  });
});
