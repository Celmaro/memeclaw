import { describe, it, expect } from 'vitest';
import { RiskEngine, globalRiskEngine } from '../src/orchestrator/risk-engine.js';
import type { OpenPosition } from '../src/position/position-manager.js';

const samplePosition = (overrides: Partial<OpenPosition> = {}): OpenPosition => ({
  positionId: 'pos_1',
  symbol: 'PEPE',
  amount: 100,
  entryPriceUsd: 0.5,
  currentPriceUsd: 0.5,
  chain: 'sol',
  ...overrides,
});

describe('unified RiskEngine', () => {
  it('tracks drawdown and blocks above the drawdown limit', () => {
    const risk = new RiskEngine({ maxPortfolioDrawdownPercent: 5, stopTradingOnDrawdown: true });
    risk.updateDrawdown(10_000, 10_000);
    risk.updateDrawdown(9_400, 10_000);
    expect(risk.getCurrentDrawdownPercent()).toBeCloseTo(6, 1);
    expect(risk.isTradeAllowed(100).allowed).toBe(false);
  });

  it('activates manually and resets after cooldown expiry', () => {
    const risk = new RiskEngine({ killSwitchCooldownMinutes: 0 });
    risk.activateKillSwitch('manual');
    expect(risk.isKillSwitchActive).toBe(true);
    expect(risk.checkKillSwitchStatus()).toBe(false);
  });

  it('rejects trade above max size', () => {
    const risk = new RiskEngine({ maxTradeAmountUsd: 500 });
    const result = risk.isTradeAllowed(501);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('max allowed trade size');
  });

  it('blocks correlated positions and deployer clusters', () => {
    const risk = new RiskEngine({ maxCorrelatedPositions: 2, maxSectorExposurePercent: 50 });
    const positions = [samplePosition({ symbol: 'PEPE' }), samplePosition({ positionId: 'pos_2', symbol: 'PEPE' })];
    const correlation = risk.checkCorrelationRisk('PEPE', 100, positions, 100_000);
    expect(correlation.allowed).toBe(false);

    const cluster = risk.checkDeployerClusterRisk(
      '0xdeployer',
      [samplePosition({ positionId: 'pos_1', deployerAddress: '0xdeployer' as any }), samplePosition({ positionId: 'pos_2', deployerAddress: '0xdeployer' as any })],
      2
    );
    expect(cluster.allowed).toBe(false);
  });

  it('enforces asset and chain exposure caps with recommended size', () => {
    const risk = new RiskEngine({ maxSingleAssetExposurePercent: 10, maxSingleChainExposurePercent: 40 });
    const portfolio = 100_000;
    const existingAsset = [{ assetSymbol: 'PEPE', chain: 'sol', usdValue: 9_000 }];
    const assetRisk = risk.evaluateTradeRisk(
      { assetSymbol: 'PEPE', chain: 'sol', usdValue: 5_000 },
      portfolio,
      existingAsset,
      0
    );
    expect(assetRisk.allowed).toBe(false);
    expect(assetRisk.recommendedPositionSizeUsd).toBe(1_000);

    const chainPositions = [
      { assetSymbol: 'MOON', chain: 'robinhood', usdValue: 30_000 },
      { assetSymbol: 'STAR', chain: 'robinhood', usdValue: 10_000 },
    ];
    const chainRisk = risk.evaluateTradeRisk(
      { assetSymbol: 'NEW', chain: 'robinhood', usdValue: 5_000 },
      portfolio,
      chainPositions,
      0
    );
    expect(chainRisk.allowed).toBe(false);
    expect(chainRisk.reason).toContain('Chain exposure cap');
  });

  it('arms kill switch after repeated losses and exposes it in risk state', () => {
    const risk = new RiskEngine({ maxConsecutiveLossesBeforeKill: 2 });
    risk.recordTradeOutcome(false);
    risk.recordTradeOutcome(false);
    expect(risk.checkKillSwitchStatus()).toBe(true);
    expect(risk.getRiskState().killSwitchActive).toBe(true);
  });

  it('exports a shared singleton for the bot runtime', () => {
    expect(globalRiskEngine).toBeInstanceOf(RiskEngine);
  });
});
