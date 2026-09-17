import { describe, expect, it } from 'vitest';
import type { GMGNRawToken } from '../src/adapters/gmgn-adapter.js';
import {
  buildLaunchEvidence,
  buildExitEvidence,
  buildGatebookEvidence,
} from '../src/agents/shared/gmgn-meme-helpers.js';

function makeToken(over: Partial<GMGNRawToken> = {}): GMGNRawToken {
  return {
    chain: 'sol',
    address: '11111111111111111111111111111111',
    symbol: 'TEST',
    name: 'Test Token',
    priceUsd: 0.0001,
    marketCapUsd: 120_000,
    volume24hUsd: 200_000,
    volume1hUsd: 80_000,
    liquidityUsd: 50_000,
    buys: 180,
    sells: 80,
    swaps: 260,
    holderCount: 240,
    top10HolderRate: 0.2,
    devTeamHoldRate: 0.08,
    creatorClose: false,
    creatorTokenStatus: null,
    smartDegenCount: 4,
    renownedCount: 1,
    bundlerRate: 0.15,
    ratTraderAmountRate: 0.1,
    rugRatio: 0.05,
    isWashTrading: false,
    isHoneypot: false,
    ctoFlag: true,
    renouncedMint: true,
    renouncedFreeze: true,
    creationTimestamp: 1730000000,
    openTimestamp: 1730000100,
    priceChange1m: 1.2,
    priceChange5m: 4.5,
    priceChange1h: 38,
    visitingCount: 350,
    squareMentions: 12,
    twitterRenameCount: 1,
    twitterDelPostCount: 0,
    twitterCreateTokenCount: 0,
    buyTax: '5',
    sellTax: '6',
    dexscrBoostFee: 0,
    dexscrAd: 0,
    totalFeeNative: 2.5,
    exchange: 'raydium',
    launchpadPlatform: 'pump',
    launchpadStatus: '1',
    progress: 1,
    source: 'gmgn',
    ...over,
  };
}

describe('GMGN meme evidence builders', () => {
  it('builds launch intelligence evidence from a graduated token snapshot', () => {
    const t = makeToken();
    const ev = buildLaunchEvidence(t);

    expect(ev.chain).toBe('sol');
    expect(ev.address).toBe(t.address);
    expect(ev.symbol).toBe('TEST');
    expect(ev.launchpad).toBe('pump');
    expect(ev.curveProgress).toBe(1);
    expect(ev.createdAt).toBe(new Date(t.creationTimestamp! * 1000).toISOString());
    expect(ev.observedAt).toBeDefined();
    expect(ev.graduated).toBe(true);
    expect(ev.migrated).toBe(true);
    expect(ev.devHoldingPct).toBe(0.08);
    expect(ev.bundleRate).toBe(0.15);
  });

  it('marks tokens still on a bonding curve as ungraduated launch evidence', () => {
    const t = makeToken({ exchange: 'pump', launchpadStatus: '0', progress: 0.4 });
    const ev = buildLaunchEvidence(t);

    expect(ev.graduated).toBe(false);
    expect(ev.migrated).toBe(false);
    expect(ev.curveProgress).toBe(0.4);
  });

  it('builds exit evidence with position sizing and token risk fields', () => {
    const t = makeToken({ isHoneypot: true });
    const ev = buildExitEvidence(t, 1_250_000, 0.5);

    expect(ev.tokenAddress).toBe(t.address);
    expect(ev.positionAmount).toBe(1_250_000);
    expect(ev.amountFraction).toBe(0.5);
    expect(ev.isHoneypot).toBe(true);
    expect(ev.canNotSell).toBe(true);
    expect(ev.buyTax).toBe('5');
    expect(ev.sellTax).toBe('6');
    expect(ev.rugRatio).toBe(0.05);
    expect(ev.bundlerRate).toBe(0.15);
  });

  it('builds gatebook evidence from GMGN security fields', () => {
    const t = makeToken({ renouncedMint: false, renouncedFreeze: false });
    const ev = buildGatebookEvidence(t);

    expect(ev.chain).toBe('sol');
    expect(ev.address).toBe(t.address);
    expect(ev.mintAuthorityActive).toBe(null);
    expect(ev.freezeAuthorityActive).toBe(null);
    expect(ev.isGraduated).toBe(true);
    expect(ev.taxPct).toBe(6);
    expect(ev.top10HolderRate).toBe(0.2);
    expect(ev.devTeamHoldRate).toBe(0.08);
  });

  it('exposes renounced authorities as disabled instead of unknown', () => {
    const t = makeToken();
    const ev = buildGatebookEvidence(t);

    expect(ev.mintAuthorityActive).toBe(false);
    expect(ev.freezeAuthorityActive).toBe(false);
  });
});
