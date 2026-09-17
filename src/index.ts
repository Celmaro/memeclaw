import dotenv from 'dotenv';
import path from 'path';
import { isDryRun as isDryRunMode } from './config/config.js';
import { Client, GatewayIntentBits, REST, Routes, ChannelType } from 'discord.js';
import { buildCallEmbed } from './discord/embeds/call-embed.js';
import type { CallCardPayload as CallSignalPayload } from './agents/shared/agent-contract.js';
import { OpenCatzHub } from './orchestrator/hub.js';
import { dispatchDomain } from './orchestrator/dispatch.js';
import { SwarmConsensusEngine } from './orchestrator/swarm-consensus.js';
import { StrategyEngine } from './orchestrator/strategy-engine.js';
import { PositionManager } from './position/position-manager.js';
import { AIService } from './services/ai-service.js';
import { slashCommands } from './discord/commands/index.js';
import { handleInteraction } from './discord/handlers/interaction-handler.js';
import { handleControlRoomMessage } from './discord/handlers/message-handler.js';
import { globalHealthWatcher } from './services/health-watcher.js';
import { globalMarketRegimeFilter } from './services/market-regime.js';
import { bootstrapDiscordChannels } from './discord/setup/channel-bootstrap.js';
import { SkillLoader } from './services/skill-loader.js';
import { SolanaTradeAdapter } from './adapters/solana-adapter.js';
import { EVMTradeAdapter } from './adapters/evm-adapter.js';
import { GMGNAdapter, type SolChain } from './adapters/gmgn-adapter.js';
import { SolanaScreeningAgent } from './agents/meme-solana/solana-screening-agent.js';
import { RobinhoodScreeningAgent } from './agents/meme-robinhood/robinhood-screening-agent.js';
import { BaseScreeningAgent } from './agents/meme-base/base-screening-agent.js';
import { EthScreeningAgent } from './agents/meme-eth/eth-screening-agent.js';
import { BscScreeningAgent } from './agents/meme-bsc/bsc-screening-agent.js';
import { CTAlphaAgent } from './agents/ct-alpha/ct-alpha-agent.js';
import { priceAlertService, tradeJournalService, walletService, priceFeedService } from './discord/handlers/interaction-handler.js';
import { TelegramService } from './telegram/telegram-service.js';
import { globalStateStore as stateStore } from './services/state-store.js';
import { ApiKeyGuardService } from './services/api-key-guard.js';
import { globalRiskEngine } from './orchestrator/risk-engine.js';
import { WalletTracker } from './services/wallet-tracker.js';
import { compileExecutionVerdict } from './orchestrator/decision-engine.js';
import { ExecutionPipeline } from './orchestrator/execution-pipeline.js';
import { ExitManager } from './orchestrator/exit-manager.js';
import { globalWalletCohortTracker } from './services/wallet-cohort-tracker.js';
import { DecisionMemory } from './services/decision-memory.js';
import type { ApprovedOrderIntent } from './domain/order-intent.js';
import type { RiskDecision } from './domain/risk-decision.js';

dotenv.config();

const telegramService = new TelegramService();
const apiKeyGuard = new ApiKeyGuardService();

console.log('----------------------------------------------------');
console.log('🐾 OPENCATZ MULTI-AGENT CRYPTO SYSTEM INITIALIZING...');
console.log('----------------------------------------------------');

const isDryRun = isDryRunMode();
console.log(`[CONFIG] DRY_RUN Mode: ${isDryRun ? 'ENABLED (Safe Mode)' : 'DISABLED (LIVE TRADING)'}`);

// Initialize persistent StateStore (survives bot restarts). Using the global
// singleton keeps the REST API and runtime loops on the same ledger.
const decisionMemory = new DecisionMemory(stateStore);

const hub = new OpenCatzHub();
const ctAlphaAgent = new CTAlphaAgent(undefined, { emitCalls: true });
const swarmEngine = new SwarmConsensusEngine();
swarmEngine.attachStateStore(stateStore);

// Wire sandboxed StrategyEngine into Swarm Consensus (active strategy can adjust confidence)
const strategyEngine = new StrategyEngine();
SwarmConsensusEngine.setStrategyProvider((domain: string) => strategyEngine.getActiveStrategy(domain));

function gateSignal(payload: any): boolean {
  const res = swarmEngine.evaluateSignal({
    symbol: payload.symbol || 'CUSTOM',
    domain: payload.domain || 'MEME_SOLANA',
    contractAddress: payload.contractAddress || '',
    liquidityUsd: Number(payload.liquidityUsd) || 0,
    volume1hUsd: Number(payload.volume1hUsd) || 0,
    securityAuditPassed: Boolean(payload.securityAuditPassed),
    socialHypeScore: Number(payload.socialHypeScore) || 0,
    confidence: Number(payload.confidenceScore) || undefined,
  });
  if (!res.passed) {
    console.warn(`[SWARM GATE] ${payload.domain} ${payload.symbol} rejected (confidence ${res.confidenceScore}%) — not posting.`);
  }
  return res.passed;
}

const AUTO_EXEC_POLICY_VERSION = 'memecoin-only-2026.09.16';
const AUTO_EXIT_POLICY_VERSION = 'memecoin-exit-2026.09.16';

function buildAutoExecuteDecision(input: { decisionId: string; domain: string; confidence: number }): RiskDecision {
  return {
    decisionId: input.decisionId,
    decisionType: 'ALLOW',
    reason: 'Deterministic auto-execute path: all screening/gates passed, LLM never signs or broadcasts.',
    policyVersion: AUTO_EXEC_POLICY_VERSION,
    decidedBy: 'algorithm',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    gates: {
      domain: input.domain,
      confidence: input.confidence,
      swarmGate: true,
    },
  };
}

function buildAutoExecuteIntent(input: {
  traceId: string;
  chain: ApprovedOrderIntent['chain'];
  venue: string;
  tokenAddress: string;
  notionalUsd: number;
  slippageBps: number;
  decisionId: string;
  launchIntelligence?: ApprovedOrderIntent['launchIntelligence'];
  tokenGatebook?: ApprovedOrderIntent['tokenGatebook'];
}): ApprovedOrderIntent {
  return {
    schemaVersion: 1,
    intentId: `intent_${input.traceId}`,
    traceId: input.traceId,
    chain: input.chain,
    venue: input.venue,
    tokenAddress: input.tokenAddress,
    side: 'BUY',
    notionalUsd: input.notionalUsd,
    minOut: 0,
    slippageBps: input.slippageBps,
    expirationAt: new Date(Date.now() + 60_000).toISOString(),
    riskDecisionId: input.decisionId,
    policyVersion: AUTO_EXEC_POLICY_VERSION,
    idempotencyKey: input.traceId,
    launchIntelligence: input.launchIntelligence,
    tokenGatebook: input.tokenGatebook,
  };
}

function buildExitDecision(input: { decisionId: string; symbol: string; reason: string }): RiskDecision {
  return {
    decisionId: input.decisionId,
    decisionType: 'ALLOW',
    reason: `Deterministic exit path: ${input.symbol} — ${input.reason}`,
    policyVersion: AUTO_EXIT_POLICY_VERSION,
    decidedBy: 'algorithm',
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    gates: { exit: true, symbol: input.symbol },
  };
}

function buildExitIntent(input: {
  traceId: string;
  chain: ApprovedOrderIntent['chain'];
  tokenAddress: string;
  notionalUsd: number;
  slippageBps: number;
  decisionId: string;
  exitSafety?: ApprovedOrderIntent['exitSafety'];
}): ApprovedOrderIntent {
  return {
    schemaVersion: 1,
    intentId: `exit_${input.traceId}`,
    traceId: input.traceId,
    chain: input.chain,
    venue: input.chain === 'sol' ? 'jupiter' : 'evmswap',
    tokenAddress: input.tokenAddress,
    side: 'SELL',
    notionalUsd: input.notionalUsd,
    minOut: 0,
    slippageBps: input.slippageBps,
    expirationAt: new Date(Date.now() + 120_000).toISOString(),
    riskDecisionId: input.decisionId,
    policyVersion: AUTO_EXIT_POLICY_VERSION,
    idempotencyKey: input.traceId,
    exitSafety: input.exitSafety,
  };
}

// Rate-limited Discord notification to #opencatz-control-room (never spam)
const controlRoomNotifyCooldown = new Map<string, number>();
const CONTROL_ROOM_NOTIFY_MS = 10 * 60 * 1000; // max 1 notif per key per 10 minutes

// Per-agent screening timeout: a stuck pass logs and resolves to [] (fail-closed),
// so one hung agent can never stall the whole sub-agent loop.
const SCREENING_TIMEOUT_MS = Math.max(1000, Number(process.env.SCREENING_TIMEOUT_MS) || 60000);
function withScreeningTimeout<T>(promise: Promise<T>, domain: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.warn(`[SCREENING TIMEOUT] ${domain.toUpperCase()} pass exceeded ${SCREENING_TIMEOUT_MS}ms — discarded, no signals emitted (fail-closed).`);
      resolve([] as unknown as T);
    }, SCREENING_TIMEOUT_MS);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

async function notifyControlRoom(client: any, key: string, content: string): Promise<void> {
  const now = Date.now();
  const last = controlRoomNotifyCooldown.get(key);
  if (last && now - last < CONTROL_ROOM_NOTIFY_MS) return;
  controlRoomNotifyCooldown.set(key, now);
  try {
    if (client && client.channels && client.channels.cache) {
      const channel = client.channels.cache.find(
        (c: any) => c.type === ChannelType.GuildText && (c.name === 'opencatz-control-room')
      );
      if (channel && 'send' in channel) {
        await channel.send(content);
      }
    }
    if (telegramService.isEnabled()) {
      await telegramService.sendMessage(content, 'Markdown');
    }
  } catch (err: any) {
    console.warn(`[NOTIFY] Control room notification failed (${key}): ${err.message}`);
  }
}


const positionManager = new PositionManager();
positionManager.attachStateStore(stateStore);

const gmgnAdapter = new GMGNAdapter();
// Read-only wallet intelligence. Cohort signals enrich alerts and research;
// they are deliberately not executable order inputs.
const WALLET_COHORT_CHAINS: SolChain[] = ['sol', 'robinhood', 'base', 'bsc', 'eth'];

// Wallet auto-tracker: mirrors user's on-chain holdings into PositionManager lifecycle + exit alerts
const walletTracker = new WalletTracker({ positionManager, stateStore, gmgn: gmgnAdapter, walletService, tradeJournal: tradeJournalService });
const exitManager = new ExitManager({ gmgn: gmgnAdapter, positionManager });

import { bootstrapCustomStrategies } from './orchestrator/strategy-bootstrap.js';

const aiService = new AIService();
await bootstrapCustomStrategies({ aiService });

const skillLoader = new SkillLoader();
const solanaTradeAdapter = new SolanaTradeAdapter();
const evmTradeAdapter = new EVMTradeAdapter();
const executionPipeline = new ExecutionPipeline(decisionMemory);
// Apply persisted per-domain screening overrides (set via chat `set_screening_config`)
const savedScreeningConfigs = stateStore.getScreeningConfigs();
const solanaScreeningAgent = new SolanaScreeningAgent(savedScreeningConfigs['meme-solana'] as any);
const robinhoodScreeningAgent = new RobinhoodScreeningAgent(savedScreeningConfigs['meme-robinhood'] as any);
const baseScreeningAgent = new BaseScreeningAgent(savedScreeningConfigs['meme-base'] as any);
const ethScreeningAgent = new EthScreeningAgent(savedScreeningConfigs['meme-eth'] as any);
const bscScreeningAgent = new BscScreeningAgent(savedScreeningConfigs['meme-bsc'] as any);

// Wire shared adapters + singleton agent instances into the Hub so on-demand
// passes (Discord/TUI) use the SAME instances as the 5-min loop.
hub.attachAgentFactories({
  'meme-solana': () => solanaScreeningAgent,
  'meme-robinhood': () => robinhoodScreeningAgent,
  'meme-base': () => baseScreeningAgent,
  'meme-eth': () => ethScreeningAgent,
  'meme-bsc': () => bscScreeningAgent,
  'ct-alpha': () => ctAlphaAgent,
});

// Attach StateStore to all persistent services
hub.attachStateStore(stateStore);
priceAlertService.attachStateStore(stateStore);
tradeJournalService.attachStateStore(stateStore);
walletService.attachStateStore(stateStore);

const loadedSkills = skillLoader.loadAllSkills();

console.log(`[SKILL SYSTEM] Active skills loaded: ${loadedSkills.length} (${loadedSkills.map(s => s.name).join(', ')})`);
console.log(`[SECURITY SERVICES] RugCheck API (Solana) & GoPlus Security (EVM - Base/ETH/Robinhood) Initialized.`);
console.log(`[SCREENING AGENTS] Memecoin trading scouts initialized: Solana, Robinhood, Base, Ethereum, BSC + CT Alpha intelligence.`);
console.log(`[SCREENING ADAPTERS] GMGN AI + Jupiter + EVM swap adapters initialized.`);
console.log(`[AI SERVICE] Configured with provider: ${aiService.getConfig().provider}, model: ${aiService.getConfig().modelName}`);

let discordClient: Client | null = null;
const discordToken = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (discordToken && clientId) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    rest: {
      // REST Discord timeout
      timeout: 30000,
    },
  });
  discordClient = client;

  client.once('ready', async () => {
    console.log(`[DISCORD BOT] Logged in as ${client.user?.tag}!`);

    // Post-update report: if a self-update just ran (fire-and-forget killed the
    // old process before it could reply), forward the saved report to the
    // control room so the user sees the update result after restart.
    try {
      const fs = await import('fs');
      const reportPath = path.join(process.cwd(), 'database', 'last_update_report.json');
      if (fs.existsSync(reportPath)) {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        fs.unlinkSync(reportPath); // one-shot: hapus setelah dibaca
        const stepLines = (report.steps || []).map((s: { label: string; ok: boolean }) => `• **${s.label}:** ${s.ok ? '✅' : '❌'}`).join('\n');
        const restartLine = report.restartOk
          ? '🔄 **PM2 agent restarted — new code is live.**'
          : '⚠ **PM2 restart failed** — run `opencatz deploy` manually.';
        const controlRoomId = process.env.DISCORD_CHANNEL_CONTROL_ROOM;
        const channel = controlRoomId
          ? client.channels.cache.get(controlRoomId)
          : client.channels.cache.find((c: any) => c.name === 'opencatz-control-room');
        if (channel && 'send' in channel) {
          await channel.send(
            `${report.ok ? '✅' : '❌'} **OpenCatz Self-Update ${report.ok ? 'Complete' : 'GAGAL'}**\n\n` +
            `${stepLines}\n${restartLine}`
          );
          console.log('[UPDATE REPORT] Laporan update dikirim ke control room.');
        }
      }
    } catch (reportErr: any) {
      console.warn(`[UPDATE REPORT] Gagal kirim laporan: ${reportErr.message}`);
    }

    // Auto-Bootstrap Discord Category & Channels if bot is in a server
    const firstGuild = client.guilds.cache.first();
    if (firstGuild) {
      try {
        await bootstrapDiscordChannels(firstGuild);
      } catch (err) {
        console.error('[DISCORD BOOTSTRAP] Channel auto-creation error:', err);
      }
    }

    // Register Slash Commands
    try {
      const rest = new REST({ version: '10' }).setToken(discordToken);
      console.log('[DISCORD REST] Registering Slash Commands...');
      await rest.put(Routes.applicationCommands(clientId), {
        body: slashCommands.map(cmd => cmd.toJSON()),
      });
      console.log('[DISCORD REST] Slash Commands registered successfully!');
    } catch (error) {
      console.error('[DISCORD REST] Error registering Slash Commands:', error);
    }
  });

  client.on('interactionCreate', (interaction) => {
    handleInteraction(interaction, hub, aiService);
  });

  client.on('messageCreate', (message) => {
    const controlRoomChannelId = process.env.DISCORD_CHANNEL_CONTROL_ROOM;
    if (isControlRoomChannel(controlRoomChannelId, message)) {
      handleControlRoomMessage(message, aiService, hub);
    }
  });

  client.login(discordToken).catch((err) => {
    console.warn(`[DISCORD BOT] Login skipped or failed: ${err.message}. Running in offline simulation mode.`);
  });
} else {
  console.log('[DISCORD BOT] DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID not set in .env. Running standalone engine.');
}

// Attach StateStore to Telegram service for persistent forum topic mappings
telegramService.attachStateStore(stateStore);

// Auto-Bootstrap Telegram Sub-Channels (Topics) & Broadcast Control Menu on startup if Telegram configured
if (telegramService.isEnabled()) {
  console.log('[TELEGRAM SERVICE] Telegram Notification Bridge Connected! Provisioning Topics & broadcasting control menu...');
  try {
    await telegramService.bootstrapTelegramTopics();
    await telegramService.broadcastInteractiveMenu(hub, walletService);
    telegramService.startPolling(hub, walletService, aiService);
  } catch (tgErr: any) {
    console.error('[TELEGRAM SERVICE] Startup broadcast error:', tgErr.message);
  }
} else {
  console.log('[TELEGRAM SERVICE] Telegram bridge not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing).');
}

// Start Price Alert Checking Interval Loop (Every 60s)
setInterval(async () => {
  try {
    const triggered = await priceAlertService.checkAlerts(priceFeedService);
    for (const alert of triggered) {
      const currentPx = alert.lastTriggeredPriceUsd || alert.targetPriceUsd;
      const alertMsg =
        `🔔 **OPENCATZ PRICE ALERT TRIGGERED!**\n\n` +
        `📈 **Asset:** \`${alert.symbol}/USDT\`\n` +
        `💵 **Target Price Hit:** \`$${alert.targetPriceUsd.toLocaleString()} USD\` (Current: \`$${currentPx.toLocaleString()} USD\`)\n` +
        `👤 **Alert for:** <@${alert.userId}>\n` +
        `🎯 **Condition:** Price reached \`${alert.direction}\` target!`;

      if (discordClient && discordClient.channels && discordClient.channels.cache) {
        const targetChannelId = alert.channelId || process.env.DISCORD_CHANNEL_CONTROL_ROOM;
        if (targetChannelId && discordClient.channels.cache.has(targetChannelId)) {
          const channel = discordClient.channels.cache.get(targetChannelId) as any;
          if (channel && 'send' in channel) {
            await channel.send(alertMsg);
          }
        }
      }
      if (telegramService.isEnabled()) {
        await telegramService.sendMessage(alertMsg, 'Markdown');
      }
    }
  } catch (err: any) {
    console.error('[PRICE ALERT LOOP ERROR]', err.message);
  }
}, 60 * 1000);

// Signal dedup cache: prevents posting same signal within 2-hour window (persisted across restarts)
const recentSignals = new Map<string, number>(); // key: "channel:symbol:ca" -> timestamp
for (const [k, v] of Object.entries(stateStore.getAllDedupEntries())) {
  recentSignals.set(k, v);
}
const DEDUP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours (GMGN trending returns the same top tokens)

// Real portfolio equity tracker (feeds RiskManager drawdown)
let prevPortfolioEquityUsd: number | null = null;

// Start 24/7 Sub-Agents Background Screening Interval Loop (Every 5 minutes)
setInterval(async () => {
  console.log('[SUB-AGENTS LOOP] Checking active sub-agent domains...');
  try {
    // Register heartbeats AT THE START of each pass so agents are marked alive while the
    // loop is running (loop interval 5m > watcher timeout, so end-of-pass heartbeats alone
    // would always trip the UNRESPONSIVE threshold between passes).
    for (const domain of hub.getActiveDomains()) {
      globalHealthWatcher.recordHeartbeat(domain);
    }
    // Real portfolio equity -> drawdown (fail-soft: skip if data unavailable)
    try {
      let currentEquityUsd = 0;
      const solBal = await walletService.getSolanaBalance();
      const solPrice = await priceFeedService.getPrice('SOL');
      if (solBal && solPrice !== null) currentEquityUsd += solBal.balance * solPrice;
      const ethBal = await walletService.getEvmBalance(1);
      const ethPrice = await priceFeedService.getPrice('ETH');
      if (ethBal && ethPrice !== null) currentEquityUsd += ethBal.balance * ethPrice;
      const openPositions = stateStore.getAllPositions();
      for (const p of openPositions) {
        currentEquityUsd += (p.currentPriceUsd ?? 0) * (p.amount ?? 0);
      }
      if (prevPortfolioEquityUsd !== null) {
        hub.getRiskManager().updateDrawdown(currentEquityUsd, prevPortfolioEquityUsd);
      }
      prevPortfolioEquityUsd = currentEquityUsd;
    } catch (equityErr: any) {
      console.warn(`[RISK] Portfolio equity unavailable this pass: ${equityErr.message}`);
    }

    // Real market regime from live BTC/ETH 24h changes (fail-soft when unavailable)
    try {
      const btcChange = await priceFeedService.get24hChange('BTC');
      const ethChange = await priceFeedService.get24hChange('ETH');
      if (btcChange !== null && ethChange !== null) {
        const volIdx = Math.min(100, Math.round(Math.max(Math.abs(btcChange), Math.abs(ethChange)) * 15));
        globalMarketRegimeFilter.updateMarketRegime(btcChange, ethChange, volIdx);
      }
    } catch (regimeErr: any) {
      console.warn(`[MARKET REGIME] Update failed: ${regimeErr.message}`);
    }

    let dispatchedPayloads: Array<{ payload: CallSignalPayload; channelName: string; rawReason: string }> = [];

    const solanaDispatched = await dispatchDomain({
      domain: 'meme-solana',
      channelName: 'call-meme-solana',
      isActive: () => hub.isAgentActive('meme-solana'),
      runPass: () => withScreeningTimeout(solanaScreeningAgent.runScreeningPass(), 'meme-solana'),
      keyReady: () => apiKeyGuard.checkDomainKeys('meme-solana'),
      onHalt: (domain, msg) => notifyControlRoom(discordClient, `halt:${domain}`, `⚠️ **${domain.toUpperCase()} TIDAK BISA JALAN**\n${msg}`),
    });
    dispatchedPayloads.push(...solanaDispatched);

    const robinhoodDispatched = await dispatchDomain({
      domain: 'meme-robinhood',
      channelName: 'call-meme-robinhood',
      isActive: () => hub.isAgentActive('meme-robinhood'),
      runPass: () => withScreeningTimeout(robinhoodScreeningAgent.runScreeningPass(), 'meme-robinhood'),
      keyReady: () => apiKeyGuard.checkDomainKeys('meme-robinhood'),
      onHalt: (domain, msg) => notifyControlRoom(discordClient, `halt:${domain}`, `⚠️ **${domain.toUpperCase()} TIDAK BISA JALAN**\n${msg}`),
    });
    dispatchedPayloads.push(...robinhoodDispatched);

    const baseDispatched = await dispatchDomain({
      domain: 'meme-base',
      channelName: 'call-meme-base',
      isActive: () => hub.isAgentActive('meme-base'),
      runPass: () => withScreeningTimeout(baseScreeningAgent.runScreeningPass(), 'meme-base'),
      keyReady: () => apiKeyGuard.checkDomainKeys('meme-base'),
      onHalt: (domain, msg) => notifyControlRoom(discordClient, `halt:${domain}`, `⚠️ **${domain.toUpperCase()} TIDAK BISA JALAN**\n${msg}`),
    });
    dispatchedPayloads.push(...baseDispatched);

    const ethDispatched = await dispatchDomain({
      domain: 'meme-eth',
      channelName: 'call-meme-eth',
      isActive: () => hub.isAgentActive('meme-eth'),
      runPass: () => withScreeningTimeout(ethScreeningAgent.runScreeningPass(), 'meme-eth'),
      keyReady: () => apiKeyGuard.checkDomainKeys('meme-eth'),
      onHalt: (domain, msg) => notifyControlRoom(discordClient, `halt:${domain}`, `⚠️ **${domain.toUpperCase()} TIDAK BISA JALAN**\n${msg}`),
    });
    dispatchedPayloads.push(...ethDispatched);

    const bscDispatched = await dispatchDomain({
      domain: 'meme-bsc',
      channelName: 'call-meme-bsc',
      isActive: () => hub.isAgentActive('meme-bsc'),
      runPass: () => withScreeningTimeout(bscScreeningAgent.runScreeningPass(), 'meme-bsc'),
      keyReady: () => apiKeyGuard.checkDomainKeys('meme-bsc'),
      onHalt: (domain, msg) => notifyControlRoom(discordClient, `halt:${domain}`, `⚠️ **${domain.toUpperCase()} TIDAK BISA JALAN**\n${msg}`),
    });
    dispatchedPayloads.push(...bscDispatched);

    const ctAlphaDispatched = await dispatchDomain({
      domain: 'ct-alpha',
      channelName: 'call-ct-alpha',
      isActive: () => hub.isAgentActive('ct-alpha'),
      runPass: () => withScreeningTimeout(ctAlphaAgent.runScreeningPass(), 'ct-alpha'),
      keyReady: () => apiKeyGuard.checkDomainKeys('ct-alpha'),
      onHalt: (domain, msg) => notifyControlRoom(discordClient, `halt:${domain}`, `⚠️ **${domain.toUpperCase()} UNAVAILABLE**\n${msg}`),
    });
    dispatchedPayloads.push(...ctAlphaDispatched);

    // Wallet cohort pass: fetch smart-money/KOL fills, then emit only
    // evidence-backed alerts. Algorithms still own all hard execution gates.
    try {
      const cohortBatches = await Promise.all(
        WALLET_COHORT_CHAINS.flatMap((chain) =>
          (['smartmoney', 'kol'] as const).map(async (kind) => ({
            chain,
            trades: await gmgnAdapter.fetchTrackTrades(chain, kind),
          }))
        )
      );
      for (const batch of cohortBatches) {
        globalWalletCohortTracker.ingest(batch.chain, batch.trades);
      }
      const cohortSignals = globalWalletCohortTracker.evaluate();
      for (const signal of cohortSignals) {
        const token = signal.tokenAddress || signal.boughtTokenAddress || 'unknown-token';
        await notifyControlRoom(
          discordClient,
          `cohort:${signal.chain}:${signal.type}:${token}`,
          `🧭 **WALLET COHORT ${signal.type}** ${signal.chain.toUpperCase()}\n${signal.note}\n` +
          `Wallets: ${signal.wallets.length} | Score: ${signal.score}/100\n` +
          `Token: \`${token}\`\n_Read-only intelligence; no automatic order created._`
        );
      }
      if (cohortSignals.length > 0) {
        console.log(`[WALLET COHORT] ${cohortSignals.length} new read-only signal(s).`);
      }
    } catch (cohortErr: any) {
      console.warn(`[WALLET COHORT] pass failed: ${cohortErr.message}`);
    }

    // Real Swarm Consensus gate (>= 80%): every signal must pass with real data
    dispatchedPayloads = dispatchedPayloads.filter((item) => gateSignal(item.payload));

    // Register real heartbeats for every active agent that ran this pass
    for (const domain of hub.getActiveDomains()) {
      globalHealthWatcher.recordHeartbeat(domain);
    }

    // Purge expired dedup entries
    const now = Date.now();
    for (const [key, ts] of recentSignals.entries()) {
      if (now - ts > DEDUP_WINDOW_MS) recentSignals.delete(key);
    }

    // Dispatch all passed signals to Discord channels & Telegram topics (with dedup)
    for (const item of dispatchedPayloads) {
      const dedupKey = `${item.channelName}:${item.payload.symbol}:${item.payload.contractAddress || 'N/A'}`;
      if (recentSignals.has(dedupKey)) {
        console.log(`[DEDUP] Skipping duplicate signal: ${dedupKey} (posted ${((now - recentSignals.get(dedupKey)!) / 60000).toFixed(0)}m ago)`);
        continue;
      }
      recentSignals.set(dedupKey, now);
      stateStore.setDedupEntry(dedupKey, now);

      // AUTO-EXECUTE — LOCKED OFF by default (manual-execution mode).
      // The bot is a screener/caller only: every execution is done by the
      // user. Flip AUTO_EXECUTE_ENABLED=true in .env to re-enable.
      const AUTO_EXECUTE_ENABLED = process.env.AUTO_EXECUTE_ENABLED === 'true';
      const autoExecDomain: string | undefined =
        item.channelName === 'call-meme-solana' ? 'meme-solana' :
        item.channelName === 'call-meme-robinhood' ? 'meme-robinhood' :
        item.channelName === 'call-meme-base' ? 'meme-base' :
        item.channelName === 'call-meme-eth' ? 'meme-eth' :
        item.channelName === 'call-meme-bsc' ? 'meme-bsc' :
        undefined;
      const traceId = `auto_${now}_${autoExecDomain || item.channelName}_${item.payload.contractAddress || item.payload.symbol || 'token'}`;
      const signalChain = autoExecDomain === 'meme-solana' ? 'sol' :
        autoExecDomain === 'meme-robinhood' ? 'robinhood' :
        autoExecDomain === 'meme-base' ? 'base' :
        autoExecDomain === 'meme-eth' ? 'eth' :
        autoExecDomain === 'meme-bsc' ? 'bsc' : 'unknown';
      try {
        decisionMemory.recordSignal({
          traceId,
          source: item.channelName.replace('call-', ''),
          chain: signalChain,
          tokenAddress: item.payload.contractAddress,
          tokenSymbol: item.payload.symbol,
          signalScore: Number(item.payload.confidenceScore) || 0,
          rawPayloadJson: JSON.stringify(item.payload),
        });
      } catch (memErr: any) {
        console.warn(`[DECISION MEMORY] signal trace failed for ${item.payload.symbol}: ${memErr.message}`);
      }
      if (autoExecDomain && AUTO_EXECUTE_ENABLED) {
        const autoExec = hub.isAutoExecuteEnabled(autoExecDomain);
        if (autoExec.enabled) {
          try {
            // ── DECISION ENGINE GATE ──
            // Algorithms emit an ALLOW decision + signed intent; LLMs never sign
            // or broadcast. compileExecutionVerdict fails closed on risk size,
            // kill-switch, stale decisions, and malformed intents.
            const decisionId = `risk_${traceId}`;
            const chainId: ApprovedOrderIntent['chain'] =
              autoExecDomain === 'meme-solana' ? 'sol' :
              autoExecDomain === 'meme-robinhood' ? 'robinhood' :
              autoExecDomain === 'meme-base' ? 'base' :
              autoExecDomain === 'meme-eth' ? 'eth' : 'bsc';
            const venue = chainId === 'sol' ? 'jupiter' : 'evmswap';
            const decision = buildAutoExecuteDecision({ decisionId, domain: autoExecDomain, confidence: Number(item.payload.confidenceScore) || 0 });
            const intent = buildAutoExecuteIntent({
              traceId,
              chain: chainId,
              venue,
              tokenAddress: item.payload.contractAddress ?? '',
              notionalUsd: autoExec.maxTradeAmount || 0.1,
              slippageBps: 150,
              decisionId,
              launchIntelligence: item.payload.launchEvidence,
              tokenGatebook: item.payload.gatebookEvidence,
            });
            const verdict = compileExecutionVerdict({ intent, decision, riskManager: hub.getRiskManager(), killSwitch: globalRiskEngine });
              if (verdict.verdict !== 'EXECUTABLE') {
              console.warn(`[AUTO-EXECUTE] ${autoExecDomain} ${item.payload.symbol}: BLOCKED by decision engine — ${verdict.reason}`);
              await notifyControlRoom(discordClient, `risk:${autoExecDomain}`, `🚫 **DECISION ENGINE BLOCKED** auto-execute ${autoExecDomain} ${item.payload.symbol}: ${verdict.reason}`);
              break;
            }
            try {
              decisionMemory.recordDecision({
                traceId,
                decisionId,
                decisionType: 'AUTO_BUY',
                reason: decision.reason,
                chain: chainId,
                tokenAddress: item.payload.contractAddress,
                tokenSymbol: item.payload.symbol,
              });
            } catch (memErr: any) {
              console.warn(`[DECISION MEMORY] decision trace failed for ${item.payload.symbol}: ${memErr.message}`);
            }
            console.log(`[AUTO-EXECUTE] ${autoExecDomain} ${item.payload.symbol}: verdict ${verdict.verdict} (${verdict.intentId}, ${verdict.notionalUsd} usd).`);
            const submitted = executionPipeline.submit({ intent, decision, riskManager: hub.getRiskManager(), killSwitch: globalRiskEngine });
            if (!submitted.ok) {
              console.warn(`[AUTO-EXECUTE] ${autoExecDomain} ${item.payload.symbol}: pipeline rejected — ${submitted.error}`);
              await notifyControlRoom(discordClient, `risk:${autoExecDomain}`, `⚠️ **EXECUTION PIPELINE REJECTED** ${autoExecDomain} ${item.payload.symbol}: ${submitted.error}`);
              break;
            }
            const pipelineOrderId = submitted.order!.intent.intentId;
            if (autoExecDomain === 'meme-solana' && item.payload.contractAddress) {
              const execRes = await solanaTradeAdapter.executeBuyToken({ outputMint: item.payload.contractAddress, amountSol: autoExec.maxTradeAmount || 0.1, slippageBps: 150 });
              if (execRes.success) executionPipeline.markSimulated(pipelineOrderId, execRes.txHash);
              else executionPipeline.markCancelled(pipelineOrderId);
              console.log(`[AUTO-EXECUTE] meme-solana ${item.payload.symbol}: ${execRes.success ? (execRes.simulated ? 'SIMULATED ' : '') + 'ok' : 'FAILED'} ${execRes.error || ''} (out=${execRes.outputTokens}, impact=${execRes.priceImpactPercentage}%)`);
            } else if ((autoExecDomain === 'meme-robinhood' || autoExecDomain === 'meme-base' || autoExecDomain === 'meme-eth' || autoExecDomain === 'meme-bsc') && item.payload.contractAddress) {
              const chainKey = autoExecDomain === 'meme-base' ? 'base' : autoExecDomain === 'meme-eth' ? 'eth' : autoExecDomain === 'meme-bsc' ? 'bsc' : 'robinhood';
              const execRes = await evmTradeAdapter.executeBuyToken({ chain: chainKey as any, tokenAddress: item.payload.contractAddress, amountEth: autoExec.maxTradeAmount || 0.1, slippagePercentage: 1.5 });
              if (execRes.success) executionPipeline.markSimulated(pipelineOrderId, execRes.txHash);
              else executionPipeline.markCancelled(pipelineOrderId);
              console.log(`[AUTO-EXECUTE] ${autoExecDomain} ${item.payload.symbol}: ${execRes.success ? (execRes.simulated ? 'SIMULATED ' : '') + 'ok' : 'FAILED'} ${execRes.error || ''} (out=${execRes.outputTokens})`);
            }

            // Record every auto-executed signal into the trade journal (real data).
            // Simulated while DRY_RUN=true — journal keeps an OPEN entry for audit/tracking.
            try {
              const entryPrice = parseFloat(String(item.payload.priceUsd || '0').replace(/[^0-9.]/g, '')) || 0;
              const journalDomain = (item.payload.domain || 'MEME_SOLANA') as any;
              const journalId = `TRADE_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              tradeJournalService.recordTradeEntry({
                id: journalId,
                domain: journalDomain,
                symbol: item.payload.symbol || 'TOKEN',
                contractAddressOrId: item.payload.contractAddress || item.payload.symbol || 'N/A',
                chain: autoExecDomain === 'meme-solana' ? 'solana' : autoExecDomain === 'meme-robinhood' ? 'robinhood' : autoExecDomain === 'meme-base' ? 'base' : autoExecDomain === 'meme-eth' ? 'eth' : 'bsc',
                entryTimestamp: new Date().toISOString(),
                entryPriceUsdOrEth: entryPrice,
                positionSizeUsd: (autoExec.maxTradeAmount || 0.1) * (entryPrice || 1),
                swarmScore: Number(item.payload.confidenceScore) || 0,
                strategyUsed: 'auto-execute',
                aiThesisSummary: (item.rawReason || item.payload.aiThesis || '').slice(0, 200),
                status: 'OPEN',
              });
              decisionMemory.recordJournal({
                traceId,
                journalId,
                source: 'trade-journal',
                chain: chainId,
                tokenAddress: item.payload.contractAddress,
                tokenSymbol: item.payload.symbol,
              });
              console.log(`[TRADE JOURNAL] Auto-execute recorded: ${item.payload.symbol} (${autoExecDomain}) OPEN entry.`);
            } catch (journalErr: any) {
              console.warn(`[TRADE JOURNAL] Failed to record ${item.payload.symbol}: ${journalErr.message}`);
            }
          } catch (err: any) { console.error(`[AUTO-EXECUTE] ${item.payload.symbol} error: ${err.message}`); }
        }
      }

      // 1. Post to Discord Channel (isolated try-catch per token)
      if (discordClient && discordClient.channels && discordClient.channels.cache) {
        try {
          const targetChannel = discordClient.channels.cache.find(
            (c: any) => c.type === ChannelType.GuildText && c.name === item.channelName
          ) as any;

          if (targetChannel && 'send' in targetChannel) {
            const embedData = buildCallEmbed(item.payload);
            await targetChannel.send(embedData);
            console.log(`[DISCORD DISPATCH] Posted signal call card for "${item.payload.symbol}" to #${item.channelName}`);
          }
        } catch (discordSendErr: any) {
          console.error(`[DISCORD DISPATCH ERROR] Failed to send card for ${item.payload.symbol} to #${item.channelName}:`, discordSendErr.message);
        }
      }

      // 2. Post to Telegram Topic
      if (telegramService.isEnabled()) {
        try {
          await telegramService.broadcastSignalCall(
            item.payload.title,
            item.payload.symbol,
            item.payload.contractAddress || 'N/A',
            item.rawReason,
            undefined,
            item.channelName
          );
          console.log(`[TELEGRAM DISPATCH] Broadcasted signal call for "${item.payload.symbol}" to topic: ${item.channelName}`);
        } catch (teleErr: any) {
          console.warn(`[TELEGRAM DISPATCH ERROR] Failed for ${item.payload.symbol}: ${teleErr.message}`);
        }
      }

      // 3. Register called tokens for wallet auto-tracking (own-position detection + exit alerts)
      if (item.channelName === 'call-meme-solana' && item.payload.contractAddress) {
        walletTracker.registerTrackedToken('sol', item.payload.contractAddress, item.payload.symbol);
      } else if (item.channelName === 'call-meme-robinhood' && item.payload.contractAddress) {
        walletTracker.registerTrackedToken('robinhood', item.payload.contractAddress, item.payload.symbol);
      } else if (item.channelName === 'call-meme-base' && item.payload.contractAddress) {
        walletTracker.registerTrackedToken('base', item.payload.contractAddress, item.payload.symbol);
      } else if (item.channelName === 'call-meme-eth' && item.payload.contractAddress) {
        walletTracker.registerTrackedToken('eth', item.payload.contractAddress, item.payload.symbol);
      } else if (item.channelName === 'call-meme-bsc' && item.payload.contractAddress) {
        walletTracker.registerTrackedToken('bsc', item.payload.contractAddress, item.payload.symbol);
      }

      // 4. Feed the Swarm Learning Engine
      try {
        const { globalSwarmLearning } = await import('./orchestrator/swarm-learning.js');
        const entryPrice = parseFloat(String(item.payload.priceUsd || '0').replace(/[^0-9.]/g, '')) || 0;
        globalSwarmLearning.recordSignalCall(
          item.channelName.replace('call-', ''),
          item.payload.symbol || 'TOKEN',
          item.payload.contractAddress || item.payload.symbol || 'N/A',
          entryPrice,
          Number(item.payload.confidenceScore) || 0
        );
      } catch (learnErr: any) {
        console.warn(`[SWARM LEARNING] record failed: ${learnErr.message}`);
      }
    }

    // Wallet Auto-Tracking: detect user's own positions + exit alerts
    try {
      const alerts = await walletTracker.syncPositions();
      if (alerts.length > 0) {
        for (const a of alerts) {
          await notifyControlRoom(discordClient, `position:${a.type}:${a.address}`, `🚨 **POSITION ALERT**\n${a.reason}`);
        }
      }
      console.log(`[POSITION MONITOR] ${positionManager.getActivePositions().length} memecoin spot positions tracked, ${alerts.length} alert(s) fired this cycle.`);
    } catch (wtErr: any) {
      console.warn(`[POSITION MONITOR] sync failed this cycle: ${wtErr.message}`);
    }

    // Algorithmic exit manager: deterministic SELL triggers for open positions.
    // AUTO_EXECUTE_ENABLED=true or AUTO_EXIT_ENABLED=true enables actual sells
    // through the same risk-gated execution pipeline as buys. Otherwise it only
    // notifies the control room so a human can take the exit.
    try {
      const AUTO_EXIT_ENABLED = process.env.AUTO_EXECUTE_ENABLED === 'true' || process.env.AUTO_EXIT_ENABLED === 'true';
      const exitTriggers = await exitManager.evaluatePositions();
      if (exitTriggers.length > 0) {
        console.log(`[EXIT MANAGER] ${exitTriggers.length} algorithmic exit trigger(s) fired.`);
      }
      for (const trigger of exitTriggers) {
        const position = positionManager.getPosition(trigger.positionId);
        const symbol = trigger.symbol || position?.symbol || 'TOKEN';
        if (!position || !(position.amount > 0)) {
          console.warn(`[EXIT MANAGER] Skipping exit for ${symbol}: no active position found.`);
          continue;
        }

        const reasonLabel = trigger.reason;
        const amountLabel = trigger.amountFraction >= 1 ? 'FULL' : `${Math.round(trigger.amountFraction * 100)}%`;
        const notifyText = `🚪 **EXIT SIGNAL** ${symbol} (${trigger.chain.toUpperCase()})\nReason: \`${reasonLabel}\` — ${trigger.notes || ''}\nPrice: $${trigger.exitPriceUsd.toFixed(8)} — Size: ${amountLabel}`;

        if (!AUTO_EXIT_ENABLED) {
          await notifyControlRoom(discordClient, `exit:${trigger.positionId}:${reasonLabel}`, notifyText);
          console.log(`[EXIT MANAGER] Manual mode: ${symbol} ${reasonLabel} — control room notified, not executed.`);
          continue;
        }

        const traceId = `exit_${Date.now()}_${trigger.chain}_${trigger.tokenAddress}_${reasonLabel}`;
        const decisionId = `risk_${traceId}`;
        const notionalUsd = Math.max(0.01, (position.currentPriceUsd || trigger.exitPriceUsd) * position.amount * trigger.amountFraction);
        const chain = trigger.chain as ApprovedOrderIntent['chain'];
        const decision = buildExitDecision({ decisionId, symbol, reason: trigger.notes || reasonLabel });
        const intent = buildExitIntent({
          traceId,
          chain,
          tokenAddress: trigger.tokenAddress,
          notionalUsd,
          slippageBps: 150,
          decisionId,
          exitSafety: trigger.exitEvidence,
        });

        const verdict = compileExecutionVerdict({ intent, decision, riskManager: hub.getRiskManager(), killSwitch: globalRiskEngine });
        if (verdict.verdict !== 'EXECUTABLE') {
          console.warn(`[EXIT MANAGER] ${symbol} ${reasonLabel}: BLOCKED by decision engine — ${verdict.reason}`);
          await notifyControlRoom(discordClient, `risk:exit:${trigger.positionId}`, `🚫 **EXIT DECISION ENGINE BLOCKED** ${symbol} ${reasonLabel}: ${verdict.reason}`);
          continue;
        }
        try {
          decisionMemory.recordDecision({
            traceId,
            decisionId,
            decisionType: 'EXIT',
            reason: decision.reason,
            chain,
            tokenAddress: trigger.tokenAddress,
            tokenSymbol: symbol,
          });
        } catch (memErr: any) {
          console.warn(`[DECISION MEMORY] exit decision trace failed for ${symbol}: ${memErr.message}`);
        }

        const submitted = executionPipeline.submit({ intent, decision, riskManager: hub.getRiskManager(), killSwitch: globalRiskEngine });
        if (!submitted.ok) {
          console.warn(`[EXIT MANAGER] ${symbol} ${reasonLabel}: pipeline rejected — ${submitted.error}`);
          await notifyControlRoom(discordClient, `risk:exit:${trigger.positionId}`, `⚠️ **EXIT PIPELINE REJECTED** ${symbol} ${reasonLabel}: ${submitted.error}`);
          continue;
        }

        const pipelineOrderId = submitted.order!.intent.intentId;
        const sellAmount = position.amount * trigger.amountFraction;
        let execSucceeded = false;
        if (trigger.chain === 'sol') {
          const execRes = await solanaTradeAdapter.executeSellToken({
            inputMint: trigger.tokenAddress,
            amountTokens: sellAmount,
            slippageBps: 150,
          });
          execSucceeded = execRes.success;
          if (execRes.success) {
            if (execRes.simulated) executionPipeline.markSimulated(pipelineOrderId, execRes.txHash);
            else executionPipeline.markFilled(pipelineOrderId, execRes.txHash || '', notionalUsd);
          } else {
            executionPipeline.markCancelled(pipelineOrderId);
          }
          console.log(`[EXIT MANAGER] ${symbol} SOL SELL ${execRes.success ? (execRes.simulated ? 'SIMULATED ' : '') + 'ok' : 'FAILED'} ${execRes.error || ''} (out=${execRes.outputTokens}, impact=${execRes.priceImpactPercentage}%)`);
        } else {
          const chainKey = trigger.chain === 'eth' ? 'eth' : trigger.chain === 'bsc' ? 'bsc' : trigger.chain === 'robinhood' ? 'robinhood' : 'base';
          const execRes = await evmTradeAdapter.executeSellToken({
            chain: chainKey,
            tokenAddress: trigger.tokenAddress,
            amountTokens: sellAmount,
            slippagePercentage: 1.5,
          });
          execSucceeded = execRes.success;
          if (execRes.success) {
            if (execRes.simulated) executionPipeline.markSimulated(pipelineOrderId, execRes.txHash);
            else executionPipeline.markFilled(pipelineOrderId, execRes.txHash || '', notionalUsd);
          } else {
            executionPipeline.markCancelled(pipelineOrderId);
          }
          console.log(`[EXIT MANAGER] ${symbol} ${chainKey.toUpperCase()} SELL ${execRes.success ? (execRes.simulated ? 'SIMULATED ' : '') + 'ok' : 'FAILED'} ${execRes.error || ''} (out=${execRes.outputTokens})`);
        }

        if (!execSucceeded) continue;

        if (trigger.amountFraction >= 1) {
          if (trigger.reason === 'TP1') positionManager.markTpTriggered(trigger.positionId, 'tp100Triggered');
          if (trigger.reason === 'TP2') positionManager.markTpTriggered(trigger.positionId, 'tp200Triggered');
          positionManager.removePosition(trigger.positionId);
        } else {
          if (trigger.reason === 'TP1') positionManager.markTpTriggered(trigger.positionId, 'tp100Triggered');
          if (trigger.reason === 'TP2') positionManager.markTpTriggered(trigger.positionId, 'tp200Triggered');
          positionManager.scalePositionAmount(trigger.positionId, 1 - trigger.amountFraction, trigger.exitPriceUsd);
        }

        try {
          const journalStatus = trigger.reason === 'TP1' || trigger.reason === 'TP2' ? 'CLOSED_TP' : trigger.reason === 'SL' ? 'CLOSED_SL' : 'CLOSED_MANUAL';
          const closed = tradeJournalService.closeByContractAddressOrId(trigger.tokenAddress, trigger.exitPriceUsd, journalStatus, trigger.reason);
          if (closed > 0) {
            decisionMemory.recordJournal({
              traceId,
              journalId: `exit:${trigger.tokenAddress}:${journalStatus}`,
              source: 'trade-journal',
              chain,
              tokenAddress: trigger.tokenAddress,
              tokenSymbol: symbol,
            });
          }
          if (closed > 0) console.log(`[EXIT MANAGER] Closed ${closed} journal entry(ies) for ${symbol} (${trigger.reason})`);
        } catch (journalErr: any) {
          console.warn(`[EXIT MANAGER] Journal close failed for ${symbol}: ${journalErr.message}`);
        }

        await notifyControlRoom(discordClient, `exit:${trigger.positionId}:${reasonLabel}`, notifyText);
      }
    } catch (exitErr: any) {
      console.warn(`[EXIT MANAGER] Exit evaluation failed this cycle: ${exitErr.message}`);
    }
  } catch (err: any) {
    console.error('[SUB-AGENTS LOOP ERROR]', (err as any).errors || err.stack || err.message);
    notifyControlRoom(discordClient, 'loop-error', `⚠️ **SCREENING LOOP ERROR**\n\`${err.message}\``);
  }
}, 5 * 60 * 1000);

function isControlRoomChannel(configuredId: string | undefined, message: any): boolean {
  if (!configuredId || configuredId === '000000000000000000') {
    return message.channel?.name === 'opencatz-control-room';
  }
  return message.channelId === configuredId || message.channel?.name === 'opencatz-control-room';
}

console.log('[SYSTEM] Setup complete. All OpenCatz modules ready.');
console.log('[STATE STORE] Persistent state engine active — positions, alerts, and journal survive restarts.');


// Start OpenCatz Telemetry & REST API Server
import { OpenCatzRESTServer } from './api/server.js';
const apiServer = new OpenCatzRESTServer();
apiServer.start(hub);

// Graceful Shutdown: flush pending state writes to disk before exit
const gracefulShutdown = (signal: string) => {
  console.log(`\n[SHUTDOWN] Received ${signal}. Flushing state to disk...`);
  stateStore.flushToDisk();
  console.log('[SHUTDOWN] State saved. Goodbye!');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
