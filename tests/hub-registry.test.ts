import { describe, it, expect, vi } from 'vitest';
import { OpenCatzHub } from '../src/orchestrator/hub.js';
import { CTAlphaAgent } from '../src/agents/ct-alpha/ct-alpha-agent.js';
import type { AgentReport, ScreeningAgent } from '../src/agents/shared/agent-contract.js';
import type { TwitterService, TweetItem } from '../src/services/twitter-service.js';

const mkReport = (symbol: string): AgentReport => ({
  passed: true,
  signal: { symbol },
  reason: 'test reason',
  confidence: 85,
});

const mkStubAgent = (domain: string, reports: AgentReport[] = []) => ({
  domain,
  runScreeningPass: vi.fn(async () => reports),
} as unknown as ScreeningAgent);

const mkTweet = (): TweetItem => ({
  id: 't1',
  text: 'Major rotation brewing - smart money positioning $ROT8',
  authorUsername: 'ct_whale',
  authorName: 'CT Whale',
  likes: 800,
  retweets: 150,
  replies: 30,
  createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  url: 'https://x.com/ct_whale/status/t1',
});

const mkFakeTwitter = (tweets: TweetItem[]) => ({
  searchTweets: vi.fn(async () => tweets),
} as unknown as TwitterService);

describe('OpenCatzHub registry-driven triggerAgentPass', () => {
  it('unknown and retired domains return [] without throwing', async () => {
    const hub = new OpenCatzHub();
    for (const domain of ['does-not-exist', 'lp-solana', 'nft-eth', 'perps', 'prediction', 'call-whale-tracking']) {
      expect(await hub.triggerAgentPass(domain)).toEqual([]);
    }
  });

  it('aliases resolve to active meme domains', async () => {
    const solStub = mkStubAgent('meme-solana', [mkReport('SOL')]);
    const solHub = new OpenCatzHub({ agentFactories: { 'meme-solana': () => solStub } });
    expect(await solHub.triggerAgentPass('solana')).toHaveLength(1);
    expect(await solHub.triggerAgentPass('solana-meme')).toHaveLength(1);

    const rhStub = mkStubAgent('meme-robinhood', [mkReport('PEPE')]);
    const rhHub = new OpenCatzHub({ agentFactories: { 'meme-robinhood': () => rhStub } });
    expect(await rhHub.triggerAgentPass('robinhood')).toHaveLength(1);
    expect(await rhHub.triggerAgentPass('rh')).toHaveLength(1);
  });

  it('all 6 active domain ids are triggerable via factories', async () => {
    const ids = ['meme-solana', 'meme-robinhood', 'meme-base', 'meme-eth', 'meme-bsc', 'ct-alpha'] as const;
    for (const id of ids) {
      const stub = mkStubAgent(id, [mkReport(id.toUpperCase())]);
      const hub = new OpenCatzHub({ agentFactories: { [id]: () => stub } });
      expect(await hub.triggerAgentPass(id), `domain ${id}`).toHaveLength(1);
    }
  });

  it('active channel names resolve through the registry', async () => {
    const ctStub = mkStubAgent('ct-alpha', [mkReport('CT')]);
    const hub = new OpenCatzHub({ agentFactories: { 'ct-alpha': () => ctStub } });
    expect(await hub.triggerAgentPass('call-ct-alpha')).toHaveLength(1);
  });

  it('ct-alpha runs the real agent with injected fake TwitterService', async () => {
    const hub = new OpenCatzHub({
      agentFactories: { 'ct-alpha': () => new CTAlphaAgent(mkFakeTwitter([mkTweet()])) },
    });
    // emitCalls defaults to false: screening runs but call output is suppressed.
    expect(await hub.triggerAgentPass('ct-alpha')).toHaveLength(0);
  });

  it('factory exceptions are caught and return []', async () => {
    const hub = new OpenCatzHub({
      agentFactories: {
        'meme-solana': () => { throw new Error('boom'); },
      },
    });
    expect(await hub.triggerAgentPass('solana')).toEqual([]);
  });
});
