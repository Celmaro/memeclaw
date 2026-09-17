import { BaseScreeningAgent, type BaseScreeningConfig } from '../meme-base/base-screening-agent.js';

/**
 * BSC meme scout: reuses the Base/GMGN EVM screening pipeline against the
 * 'bsc' chain. The Base agent now renders chain-aware payloads, so this is a
 * thin chain-specific subclass.
 */
export class BscScreeningAgent extends BaseScreeningAgent {
  readonly domain = 'meme-bsc';

  constructor(config?: Partial<BaseScreeningConfig>) {
    super({ chains: ['bsc'], ...config });
  }
}
