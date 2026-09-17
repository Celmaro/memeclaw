import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OpenCatzRESTServer } from '../src/api/server.js';
import { OpenCatzHub } from '../src/orchestrator/hub.js';

describe('OpenCatzRESTServer', () => {
  let server: OpenCatzRESTServer;
  let hub: OpenCatzHub;
  let testPort = 3099;

  beforeEach(() => {
    delete process.env.OPENCATZ_API_KEY;
    testPort += 1;
    hub = new OpenCatzHub();
    server = new OpenCatzRESTServer(testPort);
    server.start(hub);
  });

  afterEach(async () => {
    await server.stop();
  });

  it('responds to GET /health with system status', async () => {
    const res = await fetch(`http://localhost:${testPort}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBeDefined();
  });

  it('rejects unauthorized requests when OPENCATZ_API_KEY is set', async () => {
    process.env.OPENCATZ_API_KEY = 'secret-passphrase';
    const res = await fetch(`http://localhost:${testPort}/health`);
    expect(res.status).toBe(401);

    const authorizedRes = await fetch(`http://localhost:${testPort}/health`, {
      headers: { 'X-OpenCatz-Api-Key': 'secret-passphrase' },
    });
    expect(authorizedRes.status).toBe(200);
  });

  it('accepts and persists a Robinhood/Fomo tape payload', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/tape/robinhood`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        network: 'FOMO',
        pair: {
          chainId: 5318008,
          dexId: 'uniswapv3',
          baseToken: { address: '0xPITEST', symbol: 'PITEST' },
        },
        trade: {
          side: 'BUY',
          amountUsd: 321,
          maker: '0xPITESTWAL',
          txHash: '0xpitesttx',
          timestamp: Math.floor(Date.now() / 1000),
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.chain).toBe('robinhood');
    expect(data.tokenAddress).toBe('0xpitest');
    expect(data.duplicate).toBe(false);

    const memRes = await fetch(`http://localhost:${testPort}/api/memory?limit=20`);
    expect(memRes.status).toBe(200);
    const memData = await memRes.json();
    expect(Array.isArray(memData.entries)).toBe(true);
    expect(memData.entries.some((e: { source?: string }) => e.source === 'tape-robinhood')).toBe(true);
  });

  it('feeds tape maker windows into the fomo profile resolver', async () => {
    const profileId = `api-tape-profile-${Date.now()}`;
    const now = Date.now();

    for (let i = 0; i < 3; i += 1) {
      const res = await fetch(`http://localhost:${testPort}/api/tape/robinhood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          network: 'FOMO',
          profileId,
          windowStart: now - 30_000,
          windowEnd: now,
          makerCandidates: ['0xapiProfileWallet'],
          pair: {
            chainId: 5318008,
            dexId: 'uniswapv3',
            baseToken: { address: '0xAPIPROFILE', symbol: 'APIPROFILE' },
          },
          trade: {
            side: 'BUY',
            amountUsd: 100 + i,
            maker: '0xapiProfileWallet',
            txHash: `api_profile_tx_${Date.now()}_${i}`,
            timestamp: Math.floor(now / 1000),
          },
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.fomoIngested).toBe(true);
    }

    const readRes = await fetch(`http://localhost:${testPort}/api/resolver/fomo?profile=${profileId}`);
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.resolution.wallet).toBe('0xapiprofilewallet');
  });

  it('exposes callout ledger via GET /api/callouts', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/callouts`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.callouts)).toBe(true);
  });

  it('exposes decision memory via GET /api/memory', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/memory`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.entries)).toBe(true);
  });

  it('exposes wallet cohort signals via GET /api/cohort', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/cohort`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.signals)).toBe(true);
  });

  it('resolves fomo profile wallets through POST /api/resolver/fomo and reads them back', async () => {
    const now = Date.now();
    const res = await fetch(`http://localhost:${testPort}/api/resolver/fomo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        fills: [
          { profileId: 'api-pilot', windowStart: now - 30_000, windowEnd: now, makerCandidates: ['0xwallet1'], txHash: 'tx-a' },
          { profileId: 'api-pilot', windowStart: now - 20_000, windowEnd: now, makerCandidates: ['0xwallet1'], txHash: 'tx-b' },
          { profileId: 'api-pilot', windowStart: now - 10_000, windowEnd: now, makerCandidates: ['0xwallet1'], txHash: 'tx-c' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.resolutions[0].wallet).toBe('0xwallet1');

    const readRes = await fetch(`http://localhost:${testPort}/api/resolver/fomo?profile=api-pilot`);
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.resolution.wallet).toBe('0xwallet1');
  });

  it('scores a wallet deterministically via POST /api/wallet/score', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/wallet/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        wallet: '0xscoreme',
        chain: 'sol',
        trades: [{ tokenAddress: '0xa', side: 'buy', realizedPnlUsd: 100 }],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.score.detail.tradeCount).toBe(1);
  });

  it('evaluates a token through the deterministic gatebook via POST /api/gatebook/evaluate', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/gatebook/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        chain: 'robinhood',
        address: '0xdeadbeef',
        symbol: 'MEME',
        mintAuthorityActive: false,
        freezeAuthorityActive: false,
        isHoneypot: false,
        isWashTrading: false,
        taxPct: 5,
        top10HolderRate: 0.2,
        bundlerRate: 0.1,
        lpLockedPct: 0.8,
        isGraduated: true,
        marketCapUsd: 200_000,
        volume24hUsd: 150_000,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.gatebook.verdict).toBe('ALLOW');
  });

  it('evaluates launch intelligence via POST /api/launch/evaluate', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/launch/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        chain: 'sol',
        address: 'SoPumpLaunch',
        symbol: 'LAUNCH',
        launchpad: 'pumpfun',
        curveProgress: 0.9,
        createdAt: '2026-09-17T00:00:00.000Z',
        observedAt: '2026-09-17T03:00:00.000Z',
        holderCount: 400,
        buyVolumeUsd: 110_000,
        graduated: true,
        devHoldingPct: 0.1,
        bundleRate: 0.1,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.launch.verdict).toBe('HEALTHY');
  });

  it('evaluates exit safety via POST /api/exit/safety', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/exit/safety`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body: JSON.stringify({
        chain: 'robinhood',
        address: '0xExitPilot',
        symbol: 'XIT',
        priceUsd: 1,
        positionAmount: 500,
        amountFraction: 1,
        liquidityUsd: 120_000,
        volume24hUsd: 200_000,
        sellTax: 3,
        buyTax: 3,
        canNotSell: false,
        isHoneypot: false,
        creatorClose: false,
        bundlerRate: 0.2,
        rugRatio: 0.1,
        smartDegenCount: 10,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.exitSafety.verdict).toBe('CLEAR');
  });
});
