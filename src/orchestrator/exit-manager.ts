import type { GMGNAdapter, SolChain, GMGNRawToken } from '../adapters/gmgn-adapter.js';
import type { OpenPosition, PositionManager } from '../position/position-manager.js';
import { evaluateExitSafety } from '../services/exit-safety.js';
import { buildExitEvidence } from '../agents/shared/gmgn-meme-helpers.js';
import type { ExitSafetyInput } from '../domain/exit-safety.js';

export type ExitReason = 'SL' | 'TP1' | 'TP2' | 'SMART_MONEY_EXIT' | 'DEV_SELL' | 'VOLUME_DROP' | 'EXIT_SAFETY';

export interface ExitTrigger {
  positionId: string;
  symbol: string;
  chain: SolChain;
  tokenAddress: string;
  reason: ExitReason;
  exitPriceUsd: number;
  amountFraction: number;
  notes?: string;
  exitEvidence?: ExitSafetyInput;
}

export interface ExitManagerDeps {
  gmgn: Pick<GMGNAdapter, 'fetchTokenInfo'>;
  positionManager: Pick<PositionManager, 'getActivePositions'>;
  resolveChain?: (address: string, position: OpenPosition) => SolChain | null;
}

const SL_THRESHOLD_PCT = -50;
const TP1_THRESHOLD_PCT = 100;
const TP2_THRESHOLD_PCT = 200;
const VOLUME_DROP_THRESHOLD_PCT = 70;
const SMART_MONEY_HALF_FLOOR = 0.5;

function defaultChainForAddress(address: string): SolChain {
  return address.toLowerCase().startsWith('0x') ? 'robinhood' : 'sol';
}

export class ExitManager {
  private gmgn: Pick<GMGNAdapter, 'fetchTokenInfo'>;
  private positionManager: Pick<PositionManager, 'getActivePositions'>;
  private resolveChain?: ExitManagerDeps['resolveChain'];

  constructor(deps: ExitManagerDeps) {
    this.gmgn = deps.gmgn;
    this.positionManager = deps.positionManager;
    this.resolveChain = deps.resolveChain;
  }

  public async evaluatePositions(): Promise<ExitTrigger[]> {
    const triggers: ExitTrigger[] = [];
    const positions = this.positionManager.getActivePositions();

    for (const pos of positions) {
      const chain = this.resolveChain
        ? this.resolveChain(pos.contractAddress, pos)
        : pos.chain ?? defaultChainForAddress(pos.contractAddress);
      if (!chain) continue;
      const token = await this.gmgn.fetchTokenInfo(chain, pos.contractAddress);
      if (!token || !(token.priceUsd > 0) || !(pos.entryPriceUsd > 0)) continue;

      const priceChangePct = ((token.priceUsd - pos.entryPriceUsd) / pos.entryPriceUsd) * 100;

      if (priceChangePct <= SL_THRESHOLD_PCT) {
        triggers.push(this.buildTrigger(pos, token, chain, 'SL', token.priceUsd, 1, `${priceChangePct.toFixed(1)}% from entry. Hard stop-loss exit.`));
        continue;
      }

      if (token.creatorClose || token.creatorTokenStatus === 'creator_close') {
        triggers.push(this.buildTrigger(pos, token, chain, 'DEV_SELL', token.priceUsd, 1, 'Creator/dev closed their position. Hard exit.'));
        continue;
      }

      const safety = evaluateExitSafety({
        chain,
        tokenAddress: pos.contractAddress,
        symbol: pos.symbol,
        priceUsd: token.priceUsd,
        positionAmount: pos.amount,
        amountFraction: 1,
        liquidityUsd: token.liquidityUsd > 0 ? token.liquidityUsd : null,
        volume24hUsd: token.volume24hUsd > 0 ? token.volume24hUsd : null,
        buyTax: token.buyTax,
        sellTax: token.sellTax,
        canNotSell: token.isHoneypot === true ? true : null,
        isHoneypot: token.isHoneypot,
        creatorClose: token.creatorClose,
        creatorTokenStatus: token.creatorTokenStatus,
        bundlerRate: token.bundlerRate,
        rugRatio: token.rugRatio,
        top10HolderRate: token.top10HolderRate,
        smartDegenCount: token.smartDegenCount,
        priceChange1h: token.priceChange1h,
      });
      if (safety.verdict === 'BLOCK') {
        triggers.push(
          this.buildTrigger(
            pos,
            token,
            chain,
            'EXIT_SAFETY',
            token.priceUsd,
            1,
            `Exit pre-flight blocked: ${safety.reasons.join('; ')}. Hard exit.`
          )
        );
        continue;
      }

      if (this.smartMoneyDumped(pos, token.smartDegenCount)) {
        triggers.push(this.buildTrigger(pos, token, chain, 'SMART_MONEY_EXIT', token.priceUsd, 1, 'Smart-money wallets dumped or disappeared. Hard exit.'));
        continue;
      }

      if (priceChangePct >= TP2_THRESHOLD_PCT && !pos.tp200Triggered) {
        triggers.push(this.buildTrigger(pos, token, chain, 'TP2', token.priceUsd, 1, `+${priceChangePct.toFixed(1)}% from entry. Full profit-taking.`));
        continue;
      }

      if (priceChangePct >= TP1_THRESHOLD_PCT && !pos.tp100Triggered) {
        triggers.push(this.buildTrigger(pos, token, chain, 'TP1', token.priceUsd, 0.5, `+${priceChangePct.toFixed(1)}% from entry. Scale out half.`));
        continue;
      }

      const currentVolume4hUsd = token.volume24hUsd / 6;
      if (pos.initialVolume4hUsd && currentVolume4hUsd > 0) {
        const volumeDropPct = ((pos.initialVolume4hUsd - currentVolume4hUsd) / pos.initialVolume4hUsd) * 100;
        if (volumeDropPct >= VOLUME_DROP_THRESHOLD_PCT) {
          triggers.push(this.buildTrigger(pos, token, chain, 'VOLUME_DROP', token.priceUsd, 0.5, `4h volume down ${volumeDropPct.toFixed(1)}% vs entry. Dry-up exit.`));
        }
      }
    }

    return triggers;
  }

  private smartMoneyDumped(pos: OpenPosition, currentSmartMoneyCount: number): boolean {
    if (pos.initialSmartMoneyCount === undefined) return false;
    if (currentSmartMoneyCount === 0) return true;
    return pos.initialSmartMoneyCount >= 2 && currentSmartMoneyCount <= pos.initialSmartMoneyCount * SMART_MONEY_HALF_FLOOR;
  }

  private buildTrigger(
    pos: OpenPosition,
    token: GMGNRawToken,
    chain: SolChain,
    reason: ExitReason,
    exitPriceUsd: number,
    amountFraction: number,
    notes: string
  ): ExitTrigger {
    return {
      positionId: pos.id,
      symbol: pos.symbol,
      chain,
      tokenAddress: pos.contractAddress,
      reason,
      exitPriceUsd,
      amountFraction,
      notes,
      exitEvidence: buildExitEvidence(token, pos.amount, amountFraction),
    };
  }
}
