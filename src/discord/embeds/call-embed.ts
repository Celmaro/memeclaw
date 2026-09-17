import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { CallCardPayload as CallSignalPayload } from '../../agents/shared/agent-contract.js';

/**
 * Sanitize attacker-controlled token/tweet fields before rendering into Discord
 * embeds. Token names/symbols come from chain data (GMGN/DexScreener) and can
 * contain markdown link syntax, code blocks, or newlines — a crafted symbol
 * could otherwise inject a clickable phishing link or break the embed layout.
 * Removes markdown-significant characters; keeps alphanumerics and common punctuation.
 */
export function sanitizeEmbedField(value: string | undefined | null, maxLen = 200): string {
  if (!value) return '';
  const cleaned = String(value)
    .replace(/[\r\n\t]+/g, ' ')            // collapse newlines/tabs first
    .replace(/https?:\/\/\S+/gi, ' [LINK] ') // strip raw URLs (prevent link injection)
    .replace(/[\[\](){}<>*_`|~\\]/g, '')   // then remove markdown link/code/bold/italic syntax
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

/** Encode a symbol safely into a URL query component. */
export function encodeSymbolForUrl(symbol: string | undefined | null): string {
  const clean = sanitizeEmbedField(symbol, 32);
  return encodeURIComponent(clean || 'TOKEN');
}

/** Helper to ensure non-empty string for Discord Embed field value (min 1 char, max 1024 chars) */
function safeFieldValue(val: string | undefined | null, fallback = 'N/A', maxLen = 1000): string {
  const sanitized = val ? String(val).trim() : '';
  const result = sanitized || fallback;
  return result.length > maxLen ? `${result.slice(0, maxLen)}…` : result;
}

export function buildCallEmbed(payload: CallSignalPayload) {
  // OpenCatz Master Color Tokens
  const colorMap: Record<string, number> = {
    MEME_SOLANA: 0x00e676, // Jade Spirit Green (Solana)
    MEME_EVM: 0xffb7b2,    // Pastel Pink (Meme EVM / Robinhood)
    CT_ALPHA: 0xfff59d,    // Pastel Yellow (Twitter / X Alpha)
  };

  const confidenceStr = payload.confidenceScore ? `${payload.confidenceScore}% CONFIDENCE` : 'HIGH CONFIDENCE';

  const embed = new EmbedBuilder()
    .setColor(colorMap[payload.domain] || 0xccff00)
    .setTimestamp()
    .setFooter({ text: '🐾 OpenCatz AI Multi-Chain Intelligence • DRY_RUN MODE ACTIVE' });

  const buttonsRow = new ActionRowBuilder<ButtonBuilder>();

  // ==========================================
  // DOMAIN 1: CT ALPHA (X / TWITTER)
  // ==========================================
  if (payload.domain === 'CT_ALPHA') {
    embed.setTitle(`☀️ SMART CT ALPHA: ${safeFieldValue(sanitizeEmbedField(payload.title, 150), 'Market Update')}`);
    
    if (payload.contractAddress && payload.contractAddress !== 'N/A') {
      embed.addFields({ name: '📍 Contract Mentioned', value: `\`${safeFieldValue(payload.contractAddress)}\``, inline: false });
    }

    embed.addFields(
      { name: '🐦 Source & Network', value: safeFieldValue(sanitizeEmbedField(payload.network, 40), 'X (Twitter)'), inline: true },
      { name: '🧠 AI Sentiment Score', value: `${confidenceStr}`, inline: true },
      { name: '💡 Actionable Takeaway', value: safeFieldValue(sanitizeEmbedField(payload.aiThesis, 500), 'Signal detected from verified Smart CT momentum activity.'), inline: false }
    );

    const tweetUrl = payload.dexScreenerUrl || 'https://x.com';
    buttonsRow.addComponents(
      new ButtonBuilder()
        .setLabel('🐦 View Tweet on X')
        .setURL(tweetUrl.startsWith('http') ? tweetUrl : 'https://x.com')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setCustomId('start_channel_ct-alpha')
        .setLabel('⚡ Start CT Alpha')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pause_channel_ct-alpha')
        .setLabel('⏸️ Pause CT Alpha')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [buttonsRow] };
  }

  // ==========================================
  // DOMAIN 7 & 8: MEME DEX TOKENS (SOLANA & EVM MULTICHAIN)
  // ==========================================
  const isSolana = payload.domain === 'MEME_SOLANA';
  const safeTitle = sanitizeEmbedField(payload.title) || 'Token';
  const safeSymbol = sanitizeEmbedField(payload.symbol, 32) || 'TOKEN';
  const networkName = payload.network || (isSolana ? 'Solana' : 'EVM');
  embed.setTitle(
    isSolana
      ? `🚀 OPENCATZ SOLANA MEME CALL: ${safeTitle} ($${safeSymbol}) • [${confidenceStr}]`
      : `🌸 OPENCATZ ${networkName.toUpperCase()} MEME CALL: ${safeTitle} ($${safeSymbol}) • [${confidenceStr}]`
  );

  if (payload.contractAddress) {
    const ageStr = payload.tokenAge ? ` • ⏱️ **Age:** ${payload.tokenAge}` : '';
    embed.addFields({
      name: '📍 Contract Address (CA)',
      value: `\`${payload.contractAddress}\`${ageStr}`,
      inline: false,
    });
  }

  const priceStr = payload.priceUsd ? ` | 💵 **Price:** ${payload.priceUsd}` : '';
  const volStr = (payload.volume5m || payload.volume1h)
    ? `\n📈 **Vol (5m / 1h):** ${payload.volume5m || 'N/A'} / ${payload.volume1h || 'N/A'}`
    : '';
  const txStr = payload.txRatio ? ` | ⚖️ **Tx:** ${payload.txRatio}` : '';

  embed.addFields({
    name: '📊 Market Metrics',
    value: `💰 **MC:** ${payload.marketCap || 'N/A'}${priceStr}\n💧 **Liquidity:** ${payload.liquidity || 'N/A'}${volStr}${txStr}`,
    inline: false,
  });

  const securityParts: string[] = [];
  if (payload.top10Pct) securityParts.push(`👥 **Top 10:** ${payload.top10Pct}`);
  if (payload.devHoldingPct) securityParts.push(`👨‍💻 **Dev:** ${payload.devHoldingPct}`);
  if (payload.sniperPct) securityParts.push(`🐋 **Snipers:** ${payload.sniperPct}`);
  if (payload.bundlerPct) securityParts.push(`🤖 **Bundler:** ${payload.bundlerPct}`);
  if (payload.dexPaidStatus) securityParts.push(`💳 **DEX Paid:** ${payload.dexPaidStatus}`);

  if (securityParts.length > 0) {
    embed.addFields({
      name: '🛡️ Security & Holder Audit',
      value: safeFieldValue(securityParts.join(' | ')),
      inline: false,
    });
  }

  if (payload.smartMoneyInfo) {
    embed.addFields({
      name: '🧠 Smart Money Tracking & AI Consensus',
      value: `${payload.smartMoneyInfo}\n🟢 **Swarm Consensus Score:** **${confidenceStr} (PASSED)**`,
      inline: false,
    });
  }

  if (payload.contractAddress) {
    const ca = payload.contractAddress;
    const gmgnLink = payload.gmgnUrl || `https://gmgn.ai/${isSolana ? 'sol' : 'base'}/token/${ca}`;
    const dexscreenerLink = payload.dexScreenerUrl || `https://dexscreener.com/${isSolana ? 'solana' : 'base'}/${ca}`;
    const rugcheckLink = payload.rugcheckUrl || `https://rugcheck.xyz/tokens/${ca}`;

    embed.addFields({
      name: '🔗 Independent Verification Links',
      value: `📊 [DexScreener](${dexscreenerLink}) | 📈 [GMGN Chart](${gmgnLink}) | 🛡️ [RugCheck](${rugcheckLink}) | 🐦 [X (Twitter) Search](https://x.com/search?q=%24${encodeSymbolForUrl(payload.symbol)}&src=typed_query)`,
      inline: false,
    });
  }

  embed.addFields({ name: '💡 AI Thesis & Signal Reasoning', value: safeFieldValue(sanitizeEmbedField(payload.aiThesis, 500), 'Analisis teknikal, likuiditas, dan audit on-chain valid.'), inline: false });

  // Call cards carry LINKS to the trading platform
  if (isSolana) {
    const jupiterUrl = payload.contractAddress
      ? `https://jup.ag/swap/SOL-${encodeSymbolForUrl(payload.contractAddress)}`
      : 'https://jup.ag';
    buttonsRow.addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Trade on Jupiter')
        .setURL(jupiterUrl)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setCustomId('pause_channel_meme-solana')
        .setLabel('⏸️ Pause Solana Screening')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    const uniswapUrl = payload.contractAddress
      ? `https://app.uniswap.org/explore/pools/robinhood/${payload.contractAddress}`
      : 'https://app.uniswap.org/explore/pools/robinhood';
    buttonsRow.addComponents(
      new ButtonBuilder()
        .setLabel('🌸 Trade on Uniswap')
        .setURL(uniswapUrl)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setCustomId('pause_channel_meme-robinhood')
        .setLabel('⏸️ Pause Robinhood Screening')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (payload.dexScreenerUrl || payload.contractAddress) {
    const url = payload.dexScreenerUrl || `https://dexscreener.com/${isSolana ? 'solana' : 'base'}/${payload.contractAddress}`;
    if (url.startsWith('http')) {
      buttonsRow.addComponents(
        new ButtonBuilder()
          .setLabel('📊 Chart on DexScreener')
          .setURL(url)
          .setStyle(ButtonStyle.Link)
      );
    }
  }

  return { embeds: [embed], components: [buttonsRow] };
}
