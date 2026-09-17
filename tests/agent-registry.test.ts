import { describe, it, expect } from 'vitest';
import { getAgentDomain, normalizeDomainKey, AGENT_DOMAINS } from '../src/orchestrator/agent-registry.js';

describe('agent registry', () => {
  it('contains the 6 active memecoin + CT Alpha domains with dedicated channels', () => {
    expect(AGENT_DOMAINS.map((d) => d.id).sort()).toEqual(
      [
        'ct-alpha',
        'meme-base',
        'meme-bsc',
        'meme-eth',
        'meme-robinhood',
        'meme-solana',
      ].sort()
    );
  });

  it('getAgentDomain resolves canonical id, aliases, and dedicated channel names', () => {
    expect(getAgentDomain('meme-solana')?.channel).toBe('call-meme-solana');
    expect(getAgentDomain('meme-robinhood')?.channel).toBe('call-meme-robinhood');
    expect(getAgentDomain('meme-base')?.channel).toBe('call-meme-base');
    expect(getAgentDomain('meme-eth')?.channel).toBe('call-meme-eth');
    expect(getAgentDomain('meme-bsc')?.channel).toBe('call-meme-bsc');
    expect(getAgentDomain('ct-alpha')?.channel).toBe('call-ct-alpha');
    expect(getAgentDomain('solana-meme')?.id).toBe('meme-solana');
    expect(getAgentDomain('rh-meme')?.id).toBe('meme-robinhood');
    expect(getAgentDomain('bsc')?.id).toBe('meme-bsc');
    expect(getAgentDomain('meme-ink')).toBeUndefined();
    expect(getAgentDomain('unknown-agent')).toBeUndefined();
  });

  it('normalizeDomainKey strips prefixes consistently for active domains', () => {
    expect(normalizeDomainKey('MEME_SOLANA')).toBe('meme-solana');
    expect(normalizeDomainKey('call-meme-robinhood')).toBe('meme-robinhood');
    expect(normalizeDomainKey('call-meme-base')).toBe('meme-base');
    expect(normalizeDomainKey('call-meme-eth')).toBe('meme-eth');
    expect(normalizeDomainKey('call-meme-bsc')).toBe('meme-bsc');
    expect(normalizeDomainKey('call-ct-alpha')).toBe('ct-alpha');
    expect(normalizeDomainKey('solana-meme')).toBe('meme-solana');
  });

  it('legacy LP, NFT, Ink, perps and prediction domains are not registered', () => {
    for (const legacy of ['meme-ink', 'lp-solana', 'lp-robinhood', 'nft-eth', 'nft-base', 'nft-ink', 'nft-robinhood', 'nft-hyperevm', 'perps', 'prediction', 'call-whale-tracking', 'call-prediction-markets', 'call-lp-solana', 'call-nft-eth']) {
      expect(getAgentDomain(legacy), legacy).toBeUndefined();
    }
  });
});
