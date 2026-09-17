import { describe, it, expect } from 'vitest';
import { normalizeRobinhoodFomo, normalizeTape } from '../src/services/tape-normalizer.js';

describe('tape normalizer', () => {
  it('normalizes a Robinhood/Fomo chain tape event into an event envelope', () => {
    const norm = normalizeRobinhoodFomo({
      network: 'FOMO',
      pair: {
        chainId: 5318008,
        dexId: 'uniswapv3',
        baseToken: { address: '0xABCD', symbol: 'MOON' },
      },
      trade: {
        side: 'BUY',
        amountUsd: 4200,
        maker: '0xWALLET',
        txHash: '0xHASH',
        timestamp: 1_700_000_000,
      },
    });

    expect(norm).not.toBeNull();
    if (!norm) return;
    expect(norm.chain).toBe('robinhood');
    expect(norm.tokenAddress).toBe('0xabcd');
    expect(norm.tokenSymbol).toBe('MOON');
    expect(norm.side).toBe('buy');
    expect(norm.amountUsd).toBe(4200);
    expect(norm.envelope.source).toBe('tape-robinhood');
    expect(norm.envelope.kind).toBe('pair');
    expect(norm.envelope.context.chain).toBe('robinhood');
  });

  it('supports Base/BSC EVM tape payloads with no explicit side', () => {
    const norm = normalizeTape({
      chain: 'base',
      token_address: '0xBASE',
      symbol: 'BASE_MEME',
      amount_usd: 111,
      tx_hash: '0xTX',
    });

    expect(norm).not.toBeNull();
    if (!norm) return;
    expect(norm.chain).toBe('base');
    expect(norm.side).toBe('unknown');
    expect(norm.tokenAddress).toBe('0xbase');
    expect(norm.envelope.dedupeKey).toContain('tape:base:pair:0xtx');
  });

  it('returns null for malformed tape events without a token or tx anchor', () => {
    expect(normalizeTape({ raw: 'garbage' })).toBeNull();
  });
});
