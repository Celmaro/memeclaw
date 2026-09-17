export type AgentDomainId =
  | 'meme-solana'
  | 'meme-robinhood'
  | 'meme-base'
  | 'meme-eth'
  | 'meme-bsc'
  | 'ct-alpha';

export type AgentCategory = 'MEME' | 'CT_ALPHA';

export interface AgentDomainInfo {
  id: AgentDomainId;
  displayName: string;
  name: string;
  channel: string;
  aliases: string[];
  requiredKeys: string[];
  category: AgentCategory;
}

export const AGENT_DOMAINS: AgentDomainInfo[] = [
  {
    id: 'meme-solana',
    displayName: 'MEME-SOLANA',
    name: 'Solana DEX Meme Screening',
    channel: 'call-meme-solana',
    aliases: ['solana', 'solana-meme', 'sol'],
    requiredKeys: ['AI_API_KEY'],
    category: 'MEME',
  },
  {
    id: 'meme-robinhood',
    displayName: 'MEME-ROBINHOOD',
    name: 'Robinhood Chain Meme Screening',
    channel: 'call-meme-robinhood',
    aliases: ['robinhood', 'rh', 'rh-meme'],
    requiredKeys: ['AI_API_KEY'],
    category: 'MEME',
  },
  {
    id: 'meme-base',
    displayName: 'MEME-BASE',
    name: 'Base L2 Meme Screening',
    channel: 'call-meme-base',
    aliases: ['base', 'base-meme'],
    requiredKeys: ['AI_API_KEY'],
    category: 'MEME',
  },
  {
    id: 'meme-bsc',
    displayName: 'MEME-BSC',
    name: 'BNB Chain Meme Screening',
    channel: 'call-meme-bsc',
    aliases: ['bsc', 'bnb', 'bnb-chain', 'bsc-meme', 'call-meme-bsc'],
    requiredKeys: ['AI_API_KEY'],
    category: 'MEME',
  },
  {
    id: 'meme-eth',
    displayName: 'MEME-ETH',
    name: 'Ethereum Mainnet Meme Screening',
    channel: 'call-meme-eth',
    aliases: ['eth', 'ethereum', 'eth-meme', 'call-meme-ethereum'],
    requiredKeys: ['AI_API_KEY'],
    category: 'MEME',
  },
  {
    id: 'ct-alpha',
    displayName: 'CT-ALPHA',
    name: 'Smart CT & AI Narrative Intelligence',
    channel: 'call-ct-alpha',
    aliases: ['twitter', 'ct', 'ctalpha'],
    requiredKeys: ['TWEX_API_KEY', 'AI_API_KEY'],
    category: 'CT_ALPHA',
  },
  // LP, NFT, perps and prediction divisions are intentionally not registered.
  // Their legacy modules remain on disk for reference, but cannot be started by the bot.
];

function canonicalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/^call-/, '')
    .replace(/-token$/, '');
}

export function getAgentDomain(idOrAlias: string): AgentDomainInfo | undefined {
  const key = canonicalize(idOrAlias);
  return AGENT_DOMAINS.find(
    (d) => d.id === key || d.aliases.some((a) => a === key) || d.channel === idOrAlias.toLowerCase()
  );
}

export function normalizeDomainKey(idOrAlias: string): string {
  return getAgentDomain(idOrAlias)?.id ?? canonicalize(idOrAlias);
}
