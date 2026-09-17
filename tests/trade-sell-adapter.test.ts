import { describe, it, expect, vi, afterEach } from 'vitest';
import { SolanaTradeAdapter } from '../src/adapters/solana-adapter.js';
import { EVMTradeAdapter } from '../src/adapters/evm-adapter.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trade adapters sell path', () => {
  it('EVM sell returns a simulated success in dry-run via swapToken', async () => {
    const adapter = new EVMTradeAdapter();
    const result = await adapter.executeSellToken({
      chain: 'base',
      tokenAddress: '0xabc',
      amountTokens: 12345,
      slippagePercentage: 1.5,
    });
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.chain).toBe('base');
    expect(result.dexUsed).toContain('Relay');
  });

  it('Solana sell routes through Jupiter quote and returns a simulated success in dry-run', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ outAmount: 5000000000, priceImpactPct: 0.4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SolanaTradeAdapter();
    const result = await adapter.executeSellToken({
      inputMint: 'TokenMintCA',
      amountTokens: 1_000_000,
      slippageBps: 150,
    });
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('inputMint=TokenMintCA');
    expect(String(fetchMock.mock.calls[0][0])).toContain('outputMint=So11111111111111111111111111111111111111112');
  });

  it('Solana sell converts UI amount to base units when decimals are provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ outAmount: 5000000000, priceImpactPct: 0.4 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new SolanaTradeAdapter();
    await adapter.executeSellToken({
      inputMint: 'TokenMintCA',
      amountTokens: 1000,
      decimals: 3,
      slippageBps: 150,
    });

    expect(String(fetchMock.mock.calls[0][0])).toContain('amount=1000000');
  });
});
