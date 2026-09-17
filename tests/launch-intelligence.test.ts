import { describe, expect, it } from 'vitest';
import { evaluateLaunchIntelligence } from '../src/services/launch-intelligence.js';

const START = '2026-09-17T00:00:00.000Z';

describe('LaunchIntelligence', () => {
  it('flags a healthy graduated token as HEALTHY', () => {
    const result = evaluateLaunchIntelligence({
      chain: 'sol',
      address: 'SoPumpGraduated',
      symbol: 'P',
      launchpad: 'pumpfun',
      curveProgress: 0.9,
      createdAt: START,
      observedAt: '2026-09-17T03:00:00.000Z',
      holderCount: 500,
      buyVolumeUsd: 120_000,
      graduated: true,
      devHoldingPct: 0.1,
      bundleRate: 0.1,
    });
    expect(result.verdict).toBe('HEALTHY');
    expect(result.graduationState).toBe('GRADUATED');
    expect(result.score).toBeGreaterThan(80);
  });

  it('returns SLOW for a bonding token still filling the curve', () => {
    const result = evaluateLaunchIntelligence({
      chain: 'sol',
      address: 'SoBonding',
      symbol: 'SLOW',
      curveProgress: 0.1,
      createdAt: START,
      observedAt: '2026-09-17T00:05:00.000Z',
      holderCount: 120,
      buyVolumeUsd: 25_000,
      graduated: false,
      devHoldingPct: 0.2,
      bundleRate: 0.1,
    });
    expect(result.verdict).toBe('SLOW');
    expect(result.graduationState).toBe('BONDING');
    expect(result.minutesSinceLaunch).toBe(5);
  });

  it('flags a stalled curve as STALLED', () => {
    const result = evaluateLaunchIntelligence({
      chain: 'sol',
      address: 'SoStuck',
      symbol: 'STUCK',
      curveProgress: 0.2,
      createdAt: START,
      observedAt: '2026-09-17T05:00:00.000Z',
      graduated: false,
      holderCount: 80,
      buyVolumeUsd: 20_000,
      devHoldingPct: 0.2,
      bundleRate: 0.1,
    });
    expect(result.verdict).toBe('STALLED');
    expect(result.reasons.some((r) => r.includes('stall'))).toBe(true);
  });

  it('blocks a curve that filled too fast', () => {
    const result = evaluateLaunchIntelligence({
      chain: 'sol',
      address: 'SoBotFill',
      symbol: 'BOT',
      curveProgress: 0.9,
      createdAt: START,
      observedAt: '2026-09-17T00:01:00.000Z',
      graduated: false,
      holderCount: 300,
      buyVolumeUsd: 90_000,
      devHoldingPct: 0.1,
      bundleRate: 0.1,
    });
    expect(result.verdict).toBe('RISK');
    expect(result.reasons.some((r) => r.includes('fast'))).toBe(true);
  });

  it('blocks high bundler rates even after graduation', () => {
    const result = evaluateLaunchIntelligence({
      chain: 'robinhood',
      address: '0xFomoBundled',
      symbol: 'BUNDLED',
      curveProgress: 0.9,
      createdAt: START,
      observedAt: '2026-09-17T03:00:00.000Z',
      graduated: true,
      holderCount: 1000,
      buyVolumeUsd: 500_000,
      devHoldingPct: 0.1,
      bundleRate: 0.9,
    });
    expect(result.verdict).toBe('RISK');
    expect(result.reasons.some((r) => r.includes('bundled'))).toBe(true);
  });

  it('invalidates unknown launch data instead of guessing', () => {
    const result = evaluateLaunchIntelligence({
      chain: 'bsc',
      address: '0xUnknownLaunch',
      symbol: 'GHOST',
    });
    expect(result.verdict).toBe('UNKNOWN');
    expect(result.graduationState).toBe('UNKNOWN');
    expect(result.failedChecks).toBeGreaterThan(0);
  });
});
