import { PositionManager } from '../position/position-manager.js';
import type { WalletService } from './wallet-service.js';
import type { StateStore } from './state-store.js';

export interface PositionAlert {
  type: string;
  reason: string;
  address: string;
}

/**
 * PositionScanner — legacy non-memecoin position monitoring is disabled.
 */
export class PositionScanner {
  private positionManager: PositionManager;

  constructor(deps: { positionManager: PositionManager; walletService?: WalletService; stateStore?: StateStore }) {
    this.positionManager = deps.positionManager;
  }

  /**
   * Scan all external domains. Fail-closed: any missing wallet / failed API
   * returns [] (never fabricates positions, never triggers alerts).
   */
  public async scanAll(): Promise<PositionAlert[]> {
    // The bot only manages memecoin spot positions. Legacy LP, NFT,
    // prediction and perps position scanners are intentionally disabled.
    return [];
  }

}
