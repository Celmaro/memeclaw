import { describe, it, expect, vi, afterEach } from 'vitest';
import { PositionManager } from '../src/position/position-manager.js';
import { PositionScanner } from '../src/services/position-scanner.js';
import { WalletService } from '../src/services/wallet-service.js';

const mkWallet = (solana: string, evm: string) => ({
  getSolanaAddress: vi.fn(() => solana),
  getEvmAddress: vi.fn(() => evm),
} as unknown as WalletService);

describe('PositionScanner', () => {
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.SOLANA_PRIVATE_KEY; delete process.env.EVM_PRIVATE_KEY; });

  it('fail-closed: no wallet → no positions, no alerts', async () => {
    const pm = new PositionManager();
    const scanner = new PositionScanner({ positionManager: pm, walletService: undefined });
    const alerts = await scanner.scanAll();
    expect(alerts).toEqual([]);
    expect(pm.getActivePositions()).toEqual([]);
  });

  it('legacy LP, NFT, perps and prediction scanners are disabled even with stubbed APIs and keys', async () => {
    process.env.SOLANA_PRIVATE_KEY = 'sol';
    process.env.EVM_PRIVATE_KEY = 'evm';
    process.env.OPENSEA_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        assetPositions: [{ position: { coin: 'BTC', szi: '0.1', entryPx: '60000', positionValue: '6000', unrealizedPnl: '300', leverage: { value: 5, isCross: true } } }],
        positions: [{ pool: { address: 'poolX', name: 'SOL-USDC' } }],
        nfts: [{ identifier: '1', collection: 'pudgy' }],
      }),
    }));

    const pm = new PositionManager();
    const scanner = new PositionScanner({ positionManager: pm, walletService: mkWallet('solanaPubkey', '0xevm') });
    const alerts = await scanner.scanAll();
    expect(alerts).toEqual([]);
    expect(pm.getActivePositions()).toEqual([]);
    expect(pm.getActiveLpPositions()).toEqual([]);
    expect(pm.getActiveNftPositions()).toEqual([]);
  });

  it('fail-closed: API error does not crash and leaves no fabricated positions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const pm = new PositionManager();
    const scanner = new PositionScanner({ positionManager: pm, walletService: mkWallet('sol', '0xevm') });
    const alerts = await scanner.scanAll();
    expect(alerts).toEqual([]);
    expect(pm.getActivePositions()).toEqual([]);
  });
});
