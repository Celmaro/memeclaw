import { describe, it, expect } from 'vitest';
import { PositionManager } from '../src/position/position-manager.js';
import { ExitManager } from '../src/orchestrator/exit-manager.js';
import type { GMGNRawToken, SolChain } from '../src/adapters/gmgn-adapter.js';

const baseToken = (overrides: Partial<GMGNRawToken>): GMGNRawToken => ({
  chain: 'sol',
  address: 'abc',
  symbol: 'TOKEN',
  name: 'TOKEN',
  priceUsd: 1,
  marketCapUsd: 1_000_000,
  volume24hUsd: 100_000,
  volume1hUsd: 10_000,
  liquidityUsd: 50_000,
  buys: 0,
  sells: 0,
  swaps: 0,
  holderCount: 0,
  top10HolderRate: null,
  devTeamHoldRate: null,
  creatorClose: false,
  creatorTokenStatus: null,
  smartDegenCount: 10,
  renownedCount: 0,
  bundlerRate: null,
  ratTraderAmountRate: null,
  rugRatio: null,
  isWashTrading: false,
  isHoneypot: null,
  ctoFlag: false,
  renouncedMint: false,
  renouncedFreeze: false,
  creationTimestamp: null,
  openTimestamp: null,
  priceChange1m: null,
  priceChange5m: null,
  priceChange1h: null,
  visitingCount: 0,
  squareMentions: 0,
  twitterRenameCount: 0,
  twitterDelPostCount: 0,
  twitterCreateTokenCount: 0,
  buyTax: null,
  sellTax: null,
  dexscrBoostFee: 0,
  dexscrAd: 0,
  totalFeeNative: null,
  exchange: null,
  launchpadPlatform: null,
  launchpadStatus: null,
  progress: null,
  source: 'gmgn',
  ...overrides,
});

const zeroGmgn = {
  fetchTokenInfo: (_chain: SolChain, _address: string) => Promise.resolve(baseToken({})),
  fetchTrackTrades: async () => [],
};

function managerWith(positions: ReturnType<PositionManager['addPosition']> extends void ? never : any): { positionManager: PositionManager; exitManager: ExitManager } {
  const positionManager = new PositionManager();
  const exitManager = new ExitManager({ gmgn: zeroGmgn, positionManager });
  return { positionManager, exitManager };
}

describe('exit manager', () => {
  it('emits a full SELL trigger when price falls -50% below entry', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => baseToken({ address: 'abc', priceUsd: 0.5, smartDegenCount: 10, creatorClose: false });

    const triggers = await exitManager.evaluatePositions();
    expect(triggers).toHaveLength(1);
    expect(triggers[0].reason).toBe('SL');
    expect(triggers[0].amountFraction).toBe(1);
    expect(triggers[0].chain).toBe('sol');
    expect(triggers[0].exitPriceUsd).toBe(0.5);
  });

  it('emits a 50% SELL trigger at +100% TP1 and full SELL at +200%', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => baseToken({ address: 'abc', priceUsd: 2.1, smartDegenCount: 10 });
    expect((await exitManager.evaluatePositions())[0].reason).toBe('TP1');
    expect((await exitManager.evaluatePositions())[0].amountFraction).toBe(0.5);

    zeroGmgn.fetchTokenInfo = async () => baseToken({ address: 'abc', priceUsd: 3.2, smartDegenCount: 10 });
    const triggers = await exitManager.evaluatePositions();
    expect(triggers[0].reason).toBe('TP2');
    expect(triggers[0].amountFraction).toBe(1);
  });

  it('emits full SELL when smart money count drops to zero', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => baseToken({ address: 'abc', priceUsd: 1, smartDegenCount: 0 });

    const triggers = await exitManager.evaluatePositions();
    expect(triggers[0].reason).toBe('SMART_MONEY_EXIT');
    expect(triggers[0].amountFraction).toBe(1);
  });

  it('emits full EXIT_SAFETY when the exit pre-flight blocks on a honeypot', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () =>
      baseToken({ address: 'abc', priceUsd: 1, smartDegenCount: 10, isHoneypot: true });

    const triggers = await exitManager.evaluatePositions();
    expect(triggers[0].reason).toBe('EXIT_SAFETY');
    expect(triggers[0].amountFraction).toBe(1);
  });

  it('emits full SELL on creator close (dev-sell hard exit)', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => baseToken({ address: 'abc', priceUsd: 1, smartDegenCount: 10, creatorTokenStatus: 'creator_close' });

    const triggers = await exitManager.evaluatePositions();
    expect(triggers[0].reason).toBe('DEV_SELL');
    expect(triggers[0].amountFraction).toBe(1);
  });

  it('emits 50% SELL when 4h volume dries up vs initial volume', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => baseToken({ address: 'abc', priceUsd: 1.2, smartDegenCount: 10, volume24hUsd: 20_000 });

    const triggers = await exitManager.evaluatePositions();
    expect(triggers[0].reason).toBe('VOLUME_DROP');
    expect(triggers[0].amountFraction).toBe(0.5);
  });

  it('resolves chain via resolver for EVM addresses', async () => {
    const positionManager = new PositionManager();
    const exitManager = new ExitManager({
      gmgn: zeroGmgn,
      positionManager,
      resolveChain: () => 'base',
    });
    positionManager.addPosition({
      id: '0xtoken',
      symbol: 'TOKEN',
      contractAddress: '0xabc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 100,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => baseToken({ chain: 'base', address: '0xabc', priceUsd: 0.4, smartDegenCount: 10 });

    const triggers = await exitManager.evaluatePositions();
    expect(triggers[0].chain).toBe('base');
  });

  it('does not emit triggers when token info is unavailable', async () => {
    const { positionManager, exitManager } = managerWith(null);
    positionManager.addPosition({
      id: 'tok1',
      symbol: 'TOKEN',
      contractAddress: 'abc',
      entryPriceUsd: 1,
      currentPriceUsd: 1,
      amount: 1000,
      highWaterMarkUsd: 1,
      initialVolume4hUsd: 100_000,
      initialSmartMoneyCount: 10,
    });
    zeroGmgn.fetchTokenInfo = async () => null;

    await expect(exitManager.evaluatePositions()).resolves.toEqual([]);
  });
});
