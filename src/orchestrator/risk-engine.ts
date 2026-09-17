import { OpenPosition } from '../position/position-manager.js';

export interface RiskEnginelimits {
  maxPortfolioDrawdownPercent: number;
  maxTradeAmountUsd: number;
  stopTradingOnDrawdown: boolean;
  maxSectorExposurePercent: number;
  maxCorrelatedPositions: number;
  maxLpExposurePerTokenPercent: number;
  maxSingleAssetExposurePercent: number;
  maxSingleChainExposurePercent: number;
  maxConsecutiveLossesBeforeKill: number;
  killSwitchCooldownMinutes: number;
}

export interface RiskEvaluationResult {
  allowed: boolean;
  reason?: string;
  recommendedPositionSizeUsd?: number;
}

export interface PositionRiskCheck {
  assetSymbol: string;
  chain: string;
  usdValue: number;
  tags?: string[];
  volatilityAtr?: number;
}

export interface CorrelationCheckResult {
  allowed: boolean;
  reason?: string;
  existingCount: number;
  existingExposureUsd: number;
}

/**
 * Unified Memeclaw risk engine.
 *
 * It merges the old RiskManager sizing/correlation/drawdown surface with the
 * RiskEngineV2 kill-switch/exposure/evaluateTradeRisk surface. The execution
 * path only ever asks two questions: is the trade allowed by size/drawdown
 * and is the global kill switch off. Everything else remains read-only policy.
 */
export class RiskEngine {
  private limits: RiskEnginelimits;
  private currentDailyDrawdownPercent = 0;
  private tradingPaused = false;
  private isKillSwitchActive = false;
  private killSwitchActivatedAt: number | null = null;
  private consecutiveLossesCount = 0;

  constructor(customLimits?: Partial<RiskEnginelimits>) {
    this.limits = {
      maxPortfolioDrawdownPercent: 50.0,
      maxTradeAmountUsd: 500,
      stopTradingOnDrawdown: true,
      maxSectorExposurePercent: 30.0,
      maxCorrelatedPositions: 3,
      maxLpExposurePerTokenPercent: 50.0,
      maxSingleAssetExposurePercent: 10.0,
      maxSingleChainExposurePercent: 40.0,
      maxConsecutiveLossesBeforeKill: 5,
      killSwitchCooldownMinutes: 60,
      ...customLimits,
    };
  }

  public isTradeAllowed(amountUsd: number): { allowed: boolean; reason?: string } {
    if (this.checkKillSwitchStatus()) {
      return { allowed: false, reason: 'Kill switch is active.' };
    }

    if (this.tradingPaused) {
      return { allowed: false, reason: 'Trading is globally paused due to risk control limit trigger.' };
    }

    if (amountUsd > this.limits.maxTradeAmountUsd) {
      return {
        allowed: false,
        reason: `Trade amount $${amountUsd} exceeds max allowed trade size of $${this.limits.maxTradeAmountUsd}.`,
      };
    }

    if (this.currentDailyDrawdownPercent >= this.limits.maxPortfolioDrawdownPercent) {
      this.tradingPaused = true;
      return {
        allowed: false,
        reason: `Daily portfolio drawdown (${this.currentDailyDrawdownPercent}%) reached max limit (${this.limits.maxPortfolioDrawdownPercent}%). Automatically locking trading.`,
      };
    }

    return { allowed: true };
  }

  public checkCorrelationRisk(
    symbol: string,
    newPositionSizeUsd: number,
    activePositions: OpenPosition[],
    totalPortfolioUsd: number
  ): CorrelationCheckResult {
    const symbolUpper = symbol.toUpperCase();
    const correlatedPositions = activePositions.filter((p) => p.symbol.toUpperCase() === symbolUpper);
    const existingCount = correlatedPositions.length;
    const existingExposureUsd = correlatedPositions.reduce((sum, p) => sum + p.currentPriceUsd * p.amount, 0);

    if (existingCount >= this.limits.maxCorrelatedPositions) {
      return {
        allowed: false,
        reason: `Correlation Risk Block: already ${existingCount} open positions on ${symbolUpper} (max ${this.limits.maxCorrelatedPositions}).`,
        existingCount,
        existingExposureUsd,
      };
    }

    if (totalPortfolioUsd > 0) {
      const totalExposureAfter = existingExposureUsd + newPositionSizeUsd;
      const exposurePercent = (totalExposureAfter / totalPortfolioUsd) * 100;
      if (exposurePercent > this.limits.maxSectorExposurePercent) {
        return {
          allowed: false,
          reason: `Sector Exposure Cap Hit: total ${symbolUpper} exposure would reach ${exposurePercent.toFixed(1)}% of portfolio. Max allowed ${this.limits.maxSectorExposurePercent}%.`,
          existingCount,
          existingExposureUsd,
        };
      }
    }

    return { allowed: true, existingCount, existingExposureUsd };
  }

  public checkDeployerClusterRisk(
    deployerAddress: string,
    activePositions: OpenPosition[],
    maxPositionsPerCluster = 2
  ): CorrelationCheckResult {
    if (!deployerAddress) return { allowed: true, existingCount: 0, existingExposureUsd: 0 };

    const depLower = deployerAddress.toLowerCase();
    const clusterPositions = activePositions.filter((p) => (p as any).deployerAddress?.toLowerCase() === depLower);
    const existingCount = clusterPositions.length;
    const existingExposureUsd = clusterPositions.reduce((sum, p) => sum + p.currentPriceUsd * p.amount, 0);

    if (existingCount >= maxPositionsPerCluster) {
      return {
        allowed: false,
        reason: `Deployer Cluster Risk Block: already ${existingCount} open positions from deployer cluster ${deployerAddress.slice(0, 8)}...`,
        existingCount,
        existingExposureUsd,
      };
    }

    return { allowed: true, existingCount, existingExposureUsd };
  }

  public calculateDynamicPositionSizeUsd(
    baseTradeSizeUsd: number,
    volumeSurgeSpikeRatio = 1.0,
    confidenceScore = 80
  ): number {
    let multiplier = 1.0;
    if (volumeSurgeSpikeRatio >= 5.0) {
      multiplier = 0.5;
    } else if (volumeSurgeSpikeRatio >= 3.0) {
      multiplier = 0.75;
    }
    if (confidenceScore >= 90) multiplier *= 1.2;
    return Math.min(this.limits.maxTradeAmountUsd, Math.round(baseTradeSizeUsd * multiplier));
  }

  public evaluateTradeRisk(
    proposed: PositionRiskCheck,
    portfolioTotalUsd: number,
    existingPositions: PositionRiskCheck[],
    currentDrawdownPercent: number
  ): RiskEvaluationResult {
    if (this.checkKillSwitchStatus()) {
      return { allowed: false, reason: 'Emergency Kill-Switch active due to repeated loss or severe drawdown.' };
    }

    if (currentDrawdownPercent >= this.limits.maxPortfolioDrawdownPercent) {
      this.activateKillSwitch(`Global portfolio drawdown limit exceeded (${currentDrawdownPercent.toFixed(1)}%).`);
      return { allowed: false, reason: `Portfolio drawdown threshold breached (${currentDrawdownPercent.toFixed(1)}%).` };
    }

    const existingAssetUsd = existingPositions
      .filter((p) => p.assetSymbol.toUpperCase() === proposed.assetSymbol.toUpperCase())
      .reduce((sum, p) => sum + p.usdValue, 0);
    const totalAssetExposurePercent = ((existingAssetUsd + proposed.usdValue) / Math.max(portfolioTotalUsd, 1)) * 100;
    if (totalAssetExposurePercent > this.limits.maxSingleAssetExposurePercent) {
      const maxAllowedUsd = (portfolioTotalUsd * this.limits.maxSingleAssetExposurePercent) / 100 - existingAssetUsd;
      return {
        allowed: false,
        reason: `Exposure cap for ${proposed.assetSymbol} exceeded (${totalAssetExposurePercent.toFixed(1)}% > ${this.limits.maxSingleAssetExposurePercent}% max).`,
        recommendedPositionSizeUsd: Math.max(0, maxAllowedUsd),
      };
    }

    const existingChainUsd = existingPositions
      .filter((p) => p.chain.toLowerCase() === proposed.chain.toLowerCase())
      .reduce((sum, p) => sum + p.usdValue, 0);
    const totalChainExposurePercent = ((existingChainUsd + proposed.usdValue) / Math.max(portfolioTotalUsd, 1)) * 100;
    if (totalChainExposurePercent > this.limits.maxSingleChainExposurePercent) {
      return {
        allowed: false,
        reason: `Chain exposure cap for ${proposed.chain} exceeded (${totalChainExposurePercent.toFixed(1)}% > ${this.limits.maxSingleChainExposurePercent}% max).`,
      };
    }

    if (proposed.tags && proposed.tags.length > 0) {
      const correlatedCount = existingPositions.filter((pos) => (pos.tags ?? []).some((tag) => proposed.tags?.includes(tag))).length;
      if (correlatedCount >= this.limits.maxCorrelatedPositions) {
        return {
          allowed: false,
          reason: `Correlation risk cap hit (${correlatedCount} correlated positions open in tags: [${proposed.tags.join(', ')}]).`,
        };
      }
    }

    let recommendedUsd = proposed.usdValue;
    if (proposed.volatilityAtr && proposed.volatilityAtr > 0) {
      const baseAtr = 0.05;
      const volMultiplier = Math.min(2.0, Math.max(0.25, baseAtr / proposed.volatilityAtr));
      recommendedUsd = Math.round(proposed.usdValue * volMultiplier);
    }

    return { allowed: true, recommendedPositionSizeUsd: recommendedUsd };
  }

  public updateDrawdown(currentEquityUsd: number, prevEquityUsd: number): void {
    if (prevEquityUsd > 0) {
      const changePct = ((currentEquityUsd - prevEquityUsd) / prevEquityUsd) * 100;
      if (changePct < 0) {
        this.currentDailyDrawdownPercent = Math.max(this.currentDailyDrawdownPercent, Math.abs(changePct));
      }
    }
    if (this.currentDailyDrawdownPercent >= this.limits.maxPortfolioDrawdownPercent && this.limits.stopTradingOnDrawdown) {
      this.tradingPaused = true;
      console.log(`[RISK ENGINE] Drawdown ${this.currentDailyDrawdownPercent.toFixed(1)}% >= ${this.limits.maxPortfolioDrawdownPercent}%. Trading PAUSED.`);
    }
  }

  public recordTradeOutcome(isProfit: boolean): void {
    if (isProfit) {
      this.consecutiveLossesCount = 0;
    } else {
      this.consecutiveLossesCount++;
      if (this.consecutiveLossesCount >= this.limits.maxConsecutiveLossesBeforeKill) {
        this.activateKillSwitch(`${this.consecutiveLossesCount} consecutive trade losses recorded.`);
      }
    }
  }

  public activateKillSwitch(reason: string): void {
    this.isKillSwitchActive = true;
    this.killSwitchActivatedAt = Date.now();
    console.error(`🚨 RISK ENGINE: Emergency Kill Switch Activated! Reason: ${reason}`);
  }

  public resetKillSwitch(): void {
    this.isKillSwitchActive = false;
    this.killSwitchActivatedAt = null;
    this.consecutiveLossesCount = 0;
    console.log('✅ RISK ENGINE: Kill Switch manually reset.');
  }

  public checkKillSwitchStatus(): boolean {
    if (!this.isKillSwitchActive) return false;
    if (this.killSwitchActivatedAt) {
      const elapsedMinutes = (Date.now() - this.killSwitchActivatedAt) / (1000 * 60);
      if (elapsedMinutes >= this.limits.killSwitchCooldownMinutes) {
        this.resetKillSwitch();
        return false;
      }
    }
    return true;
  }

  public getCurrentDrawdownPercent(): number {
    return this.currentDailyDrawdownPercent;
  }

  public resetDailyDrawdown(): void {
    this.currentDailyDrawdownPercent = 0;
    this.tradingPaused = false;
  }

  public setDrawdownLimit(percent: number): void {
    this.limits.maxPortfolioDrawdownPercent = percent > 1 ? percent : percent * 100;
    console.log(`[RISK ENGINE] Updated Max Drawdown Limit to ${this.limits.maxPortfolioDrawdownPercent}%`);
  }

  public setMaxPositionSizeUsd(amountUsd: number): void {
    this.limits.maxTradeAmountUsd = amountUsd;
    console.log(`[RISK ENGINE] Updated Max Position Size to $${amountUsd}`);
  }

  public getRiskState() {
    return {
      paused: this.tradingPaused || this.checkKillSwitchStatus(),
      currentDrawdownPct: this.currentDailyDrawdownPercent,
      maxDrawdownLimitPct: this.limits.maxPortfolioDrawdownPercent,
      maxPositionSizeUsd: this.limits.maxTradeAmountUsd,
      maxSectorExposurePercent: this.limits.maxSectorExposurePercent,
      maxCorrelatedPositions: this.limits.maxCorrelatedPositions,
      maxSingleAssetExposurePercent: this.limits.maxSingleAssetExposurePercent,
      maxSingleChainExposurePercent: this.limits.maxSingleChainExposurePercent,
      killSwitchActive: this.checkKillSwitchStatus(),
    };
  }
}

export const globalRiskEngine = new RiskEngine();
