import { Guild, ChannelType, CategoryChannel } from 'discord.js';

export interface ChannelSetupResult {
  controlRoomId: string;
  auditOnDemandId: string;
  memeSolanaId: string;
  memeRobinhoodId: string;
  memeBaseId: string;
  memeEthId: string;
  memeBscId: string;
  ctAlphaId: string;
}

export async function bootstrapDiscordChannels(guild: Guild): Promise<ChannelSetupResult> {
  console.log(`[DISCORD BOOTSTRAP] Checking & auto-creating OpenCatz categorized channels in guild: "${guild.name}"...`);

  // Helper to get or create a category
  const getOrCreateCategory = async (name: string, searchTerms: string[]): Promise<CategoryChannel> => {
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && searchTerms.some(t => c.name.toLowerCase().includes(t.toLowerCase()))
    ) as CategoryChannel | undefined;

    if (!category) {
      category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
      });
      console.log(`[DISCORD BOOTSTRAP] Created Category: "${name}"`);
    }
    return category;
  };

  // 1. Categories
  const catCommand = await getOrCreateCategory('🐾 OPENCATZ COMMAND CENTER', ['command center', 'opencatz']);
  const catMeme = await getOrCreateCategory('🚀 MEME COIN CALLS', ['meme coin', 'meme calls']);
  const catCt = await getOrCreateCategory('☀️ SMART CT ALPHA', ['smart ct', 'ct alpha', 'alpha']);

  // Helper to get or create channel under category
  const getOrCreateChannel = async (categoryId: string, name: string, topic: string, legacyNames?: string[]) => {
    let channel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && (c.name === name || (legacyNames && legacyNames.includes(c.name)))
    );

    if (!channel) {
      channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: categoryId,
        topic,
      });
      console.log(`[DISCORD BOOTSTRAP] Auto-created Channel: #${name}`);
    } else if (channel.parentId !== categoryId) {
      try {
        if ('setParent' in channel && typeof (channel as any).setParent === 'function') {
          await (channel as any).setParent(categoryId);
        }
      } catch (e: any) {
        console.warn(`[DISCORD BOOTSTRAP] Could not move #${name} to category: ${e.message}`);
      }
    }
    return channel.id;
  };

  // Category 1: Command Center
  const controlRoomId = await getOrCreateChannel(
    catCommand.id,
    'opencatz-control-room',
    '⚙️ OpenCatz Core Command Hub - Chat with AI, wallet management, & 9-Lives risk configuration.'
  );

  const auditOnDemandId = await getOrCreateChannel(
    catCommand.id,
    'opencatz-audit',
    '🔎 On-Demand Token Audit Channel - Paste any Solana or EVM Contract Address (CA) here for instant 12-point audit!',
    ['audit-on-demand']
  );

  // Category 2: Meme Coin Calls
  const memeSolanaId = await getOrCreateChannel(
    catMeme.id,
    'call-meme-solana',
    '🚀 High-Confidence Solana DEX Signal Calls (Pump.fun, Raydium, Meteora)'
  );

  const memeRobinhoodId = await getOrCreateChannel(
    catMeme.id,
    'call-meme-robinhood',
    '🌸 High-Confidence Robinhood Chain Meme Signal Calls (GMGN + GoPlus)'
  );

  const memeBaseId = await getOrCreateChannel(
    catMeme.id,
    'call-meme-base',
    '🔵 High-Confidence Base L2 Meme Signal Calls (GMGN + GoPlus Security)'
  );

  const memeEthId = await getOrCreateChannel(
    catMeme.id,
    'call-meme-eth',
    '💎 High-Confidence Ethereum Mainnet Meme Signal Calls (Uniswap + GoPlus)'
  );

  const memeBscId = await getOrCreateChannel(
    catMeme.id,
    'call-meme-bsc',
    '🟡 High-Confidence BNB Chain Meme Signal Calls (GMGN + GoPlus Security)'
  );

  const ctAlphaId = await getOrCreateChannel(
    catCt.id,
    'call-ct-alpha',
    '☀️ Smart Crypto Twitter (CT) & AI Alpha - Airdrop threads, AI Agent launches, & Smart Money Calls'
  );

  console.log('[DISCORD BOOTSTRAP] Active meme trading channels are ready!');

  return {
    controlRoomId,
    auditOnDemandId,
    memeSolanaId,
    memeRobinhoodId,
    memeBaseId,
    memeEthId,
    memeBscId,
    ctAlphaId,
  };
}
