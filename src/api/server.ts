import http from 'node:http';
import { OpenCatzHub } from '../orchestrator/hub.js';
import { globalHealthWatcher } from '../services/health-watcher.js';
import { globalMarketRegimeFilter } from '../services/market-regime.js';
import { globalRiskEngine } from '../orchestrator/risk-engine.js';
import { tradeJournalService } from '../discord/handlers/command-handlers.js';
import { globalStateStore } from '../services/state-store.js';
import { getExecutionMode } from '../config/config.js';
import { AGENT_DOMAINS } from '../orchestrator/agent-registry.js';
import { ToolRegistry } from '../orchestrator/tool-registry.js';
import { GMGNCalloutRouter } from '../services/gmgn-callout-router.js';
import { globalWalletCohortTracker } from '../services/wallet-cohort-tracker.js';
import { globalDecisionMemory } from '../services/decision-memory.js';
import { TapeIngestRouter } from '../services/tape-ingest-router.js';
import { globalFomoWalletResolver, type FomoFillEvidence } from '../services/fomo-wallet-resolver.js';
import { globalSmartMoneyWalletScorer, type SmartWalletTrade } from '../services/smart-money-wallet-scorer.js';
import type { TokenGatebookInput } from '../domain/token-gatebook.js';
import { evaluateTokenGatebook } from '../services/token-gatebook.js';
import type { LaunchIntelligenceInput } from '../domain/launch-intelligence.js';
import { evaluateLaunchIntelligence } from '../services/launch-intelligence.js';
import type { ExitSafetyInput } from '../domain/exit-safety.js';
import { evaluateExitSafety } from '../services/exit-safety.js';

export class OpenCatzRESTServer {
  private server: http.Server | null = null;
  private port: number;
  private toolRegistry = new ToolRegistry();

  constructor(port = 3000) {
    this.port = Number(process.env.API_PORT) || port;
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }

  public start(hub: OpenCatzHub): void {
    this.toolRegistry.attachOrchestrator(hub);
    const gmgnCalloutRouter = new GMGNCalloutRouter({
      stateStore: globalStateStore,
      walletCohort: globalWalletCohortTracker,
    });
    const tapeIngestRouter = new TapeIngestRouter({
      stateStore: globalStateStore,
      walletCohort: globalWalletCohortTracker,
      fomoResolver: globalFomoWalletResolver,
      decisionMemory: globalDecisionMemory,
    });

    this.server = http.createServer(async (req, res) => {
      // Set CORS Headers for website integration
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OpenCatz-Api-Key');
      res.setHeader('Content-Type', 'application/json');

      // Handle CORS Preflight
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      // API Key Authentication Guard (if OPENCATZ_API_KEY environment variable is configured)
      const authKey = process.env.OPENCATZ_API_KEY;
      if (authKey && authKey.trim() !== '') {
        const clientKey = req.headers['x-opencatz-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        if (clientKey !== authKey) {
          res.statusCode = 401;
          res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or missing OPENCATZ_API_KEY' }));
          return;
        }
      }

      const urlObj = new URL(req.url || '/', `http://localhost:${this.port}`);
      const pathname = urlObj.pathname;

      try {
        // 1. GET /health or /api/status (Full system status & setup overview)
        if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/status')) {
          const health = globalHealthWatcher.auditSystemHealth();
          const regime = globalMarketRegimeFilter.getRegime();
          const isKillSwitch = globalRiskEngine.checkKillSwitchStatus();

          const subAgents = AGENT_DOMAINS.map((d) => ({
            id: d.id,
            name: d.name,
            channel: d.channel,
            active: hub.isAgentActive(d.id),
            category: d.category,
          }));

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              status: isKillSwitch ? 'KILL_SWITCH_LOCKED' : health.allHealthy ? 'HEALTHY' : 'DEGRADED',
              executionMode: getExecutionMode(),
              primaryVenue: 'Multi-Chain Memecoin Trading (Solana, Robinhood, Base, Ethereum, Ink)',
              activeDomains: hub.getActiveDomains(),
              subAgents,
              marketRegime: regime,
              connectedApiKeys: {
                goplus: Boolean(process.env.GOPLUS_API_KEY),
                twex: Boolean(process.env.TWEX_API_KEY),
                llm: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY),
                gmgn: Boolean(process.env.GMGN_API_KEY),
              },
              subAgentsReport: health.report,
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        // 2. GET /api/calls (Signal call cards across all sub-agents)
        if (req.method === 'GET' && pathname === '/api/calls') {
          const domainFilter = urlObj.searchParams.get('domain') || undefined;
          const limitParam = Number(urlObj.searchParams.get('limit')) || 50;
          const ledger = globalStateStore.getSignalLedger(domainFilter, limitParam);

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              totalCalls: ledger.length,
              domainFilter: domainFilter || 'ALL',
              calls: ledger,
            })
          );
          return;
        }

        // 3. GET /api/positions (Active monitored memecoin positions)
        if (req.method === 'GET' && pathname === '/api/positions') {
          const openTokens = globalStateStore.getAllPositions();

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              summary: {
                tokenCount: openTokens.length,
              },
              tokens: openTokens,
            })
          );
          return;
        }

        // 4. GET /api/executions (Trade Journal audit trail & analytics summary)
        if (req.method === 'GET' && (pathname === '/api/executions' || pathname === '/api/journal' || pathname === '/api/analytics')) {
          const summary = tradeJournalService.getSummaryStats();
          const allEntries = tradeJournalService.listTrades();

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              analytics: summary,
              entries: allEntries,
            })
          );
          return;
        }

        // 5. GET /api/alerts (Custom price alerts)
        if (req.method === 'GET' && pathname === '/api/alerts') {
          const alerts = globalStateStore.getAllAlerts();
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              totalAlerts: alerts.length,
              alerts,
            })
          );
          return;
        }

        // 6. POST /api/agents/toggle (Enable / Pause sub-agent dynamically)
        if (req.method === 'POST' && pathname === '/api/agents/toggle') {
          const body = await parseJsonBody(req);
          const domain = String(body.domain || '').trim().toLowerCase();
          const active = Boolean(body.active);

          if (!domain) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing required field "domain"' }));
            return;
          }

          hub.setAgentActive(domain, active);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              domain,
              active: hub.isAgentActive(domain),
              message: `Sub-agent "${domain}" status updated to ${active ? '🟢 ACTIVE' : '🔴 PAUSED'}`,
            })
          );
          return;
        }

        // 7. POST /api/command (Execute ToolRegistry commands from website UI)
        if (req.method === 'POST' && pathname === '/api/command') {
          const body = await parseJsonBody(req);
          const toolName = String(body.command || body.toolName || '').trim();
          const args = body.args || {};

          if (!toolName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing required field "command" or "toolName"' }));
            return;
          }

          const result = await this.toolRegistry.executeToolCall(toolName, args);
          res.statusCode = result.success ? 200 : 400;
          res.end(JSON.stringify(result));
          return;
        }

        // 7b. POST /api/callout/gmgn (GMGN push/webhook ingestion)
        if (req.method === 'POST' && pathname === '/api/callout/gmgn') {
          const body = await parseJsonBody(req);
          const callout = gmgnCalloutRouter.ingest(body);
          globalDecisionMemory.recordSignal({
            traceId: callout.envelope.traceId,
            source: callout.envelope.source,
            chain: callout.chain ?? 'sol',
            tokenAddress: callout.tokenAddress ?? undefined,
            tokenSymbol: callout.tokenSymbol,
            rawPayloadJson: JSON.stringify(body),
          });
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              chain: callout.chain,
              tokenAddress: callout.tokenAddress,
              tokenSymbol: callout.tokenSymbol,
              side: callout.side,
              amountUsd: callout.amountUsd,
              envelopeId: callout.envelope.eventId,
              dedupeKey: callout.envelope.dedupeKey,
              stored: true,
              duplicate: callout.duplicate ?? false,
            })
          );
          return;
        }

        // 7c. POST /api/tape/robinhood (read-only tape event ingestion)
        if (req.method === 'POST' && pathname === '/api/tape/robinhood') {
          const body = await parseJsonBody(req);
          const tape = tapeIngestRouter.ingest(body, { source: 'tape-robinhood', chain: 'robinhood' });
          if (!tape.success || !tape.normalized) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Malformed tape payload or unsupported chain' }));
            return;
          }
          const norm = tape.normalized;

          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              chain: norm.chain,
              tokenAddress: norm.tokenAddress,
              tokenSymbol: norm.tokenSymbol || '',
              side: norm.side,
              amountUsd: norm.amountUsd,
              envelopeId: norm.envelope.eventId,
              dedupeKey: norm.envelope.dedupeKey,
              stored: tape.stored,
              duplicate: tape.duplicate,
              fomoIngested: tape.fomoIngested,
            })
          );
          return;
        }

        // 7d. GET /api/cohort (wallet convergence, rotation, dormant-wake signals)
        if (req.method === 'GET' && pathname === '/api/cohort') {
          const signals = globalWalletCohortTracker.peek();
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              totalSignals: signals.length,
              signals,
            })
          );
          return;
        }

        // 7e. GET /api/callouts (fast-path push event audit trail)
        if (req.method === 'GET' && pathname === '/api/callouts') {
          const limitParam = Number(urlObj.searchParams.get('limit')) || 50;
          const callouts = globalStateStore.getCalloutLedger(limitParam);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              totalCallouts: callouts.length,
              callouts,
            })
          );
          return;
        }

        // 7f. GET /api/memory (decision memory trace: signal -> decision -> order -> journal)
        if (req.method === 'GET' && pathname === '/api/memory') {
          const traceId = urlObj.searchParams.get('traceId') || undefined;
          const limitParam = Number(urlObj.searchParams.get('limit')) || 100;
          const entries = globalStateStore.getDecisionMemory(traceId, limitParam);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              traceId: traceId || null,
              totalEntries: entries.length,
              entries,
            })
          );
          return;
        }

        // 7g. POST /api/resolver/fomo (profile -> wallet evidence ingestion + resolution)
        if (req.method === 'POST' && pathname === '/api/resolver/fomo') {
          const body = await parseJsonBody(req);
          const fills: FomoFillEvidence[] = Array.isArray(body.fills) ? body.fills : (body.fill ? [body.fill] : []);
          if (fills.length === 0) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Expected "fills" array or "fill" object' }));
            return;
          }
          for (const fill of fills) {
            globalFomoWalletResolver.ingestFill(fill);
          }
          const profileIds = Array.from(new Set(fills.map((f) => f.profileId.trim().toLowerCase())));
          const resolutions = profileIds.map((profileId) => globalFomoWalletResolver.resolve(profileId));
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              ingested: fills.length,
              profiles: profileIds,
              resolutions,
            })
          );
          return;
        }

        // 7h. GET /api/resolver/fomo (read current profile resolutions)
        if (req.method === 'GET' && pathname === '/api/resolver/fomo') {
          const profile = urlObj.searchParams.get('profile')?.trim().toLowerCase();
          if (profile) {
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, resolution: globalFomoWalletResolver.resolve(profile) }));
            return;
          }
          const snapshot = globalFomoWalletResolver.snapshot();
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, total: snapshot.length, resolutions: snapshot }));
          return;
        }

        // 7i. POST /api/wallet/score (deterministic wallet admission scoring)
        if (req.method === 'POST' && pathname === '/api/wallet/score') {
          const body = await parseJsonBody(req);
          const wallet = String(body.wallet || '').trim().toLowerCase();
          if (!wallet) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing required field "wallet"' }));
            return;
          }
          const trades: SmartWalletTrade[] = Array.isArray(body.trades) ? body.trades : [];
          const scored = globalSmartMoneyWalletScorer.score({
            wallet,
            chain: body.chain || 'unknown',
            trades,
            pnlSnapshots: Array.isArray(body.pnlSnapshots) ? body.pnlSnapshots : undefined,
            profileLabels: Array.isArray(body.profileLabels) ? body.profileLabels : undefined,
          });
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, score: scored }));
          return;
        }

        // 7j. POST /api/gatebook/evaluate (deterministic token hard-gate check)
        if (req.method === 'POST' && pathname === '/api/gatebook/evaluate') {
          const body = await parseJsonBody(req);
          const input: TokenGatebookInput = {
            chain: String(body.chain || 'unknown'),
            address: String(body.address || ''),
            symbol: body.symbol,
            mintAuthorityActive: body.mintAuthorityActive,
            freezeAuthorityActive: body.freezeAuthorityActive,
            isHoneypot: body.isHoneypot,
            isWashTrading: body.isWashTrading,
            taxPct: body.taxPct,
            top10HolderRate: body.top10HolderRate,
            bundlerRate: body.bundlerRate,
            lpLockedPct: body.lpLockedPct,
            isGraduated: body.isGraduated,
            devTeamHoldRate: body.devTeamHoldRate,
            holderCount: body.holderCount,
            minLiquidityUsd: body.minLiquidityUsd,
            marketCapUsd: body.marketCapUsd,
            volume24hUsd: body.volume24hUsd,
          };
          if (!input.address) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing required field "address"' }));
            return;
          }
          const result = evaluateTokenGatebook(input, body.options ?? {});
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, gatebook: result }));
          return;
        }

        // 7k. POST /api/launch/evaluate (read-only launch intelligence)
        if (req.method === 'POST' && pathname === '/api/launch/evaluate') {
          const body = await parseJsonBody(req);
          const input: LaunchIntelligenceInput = {
            chain: String(body.chain || 'unknown'),
            address: String(body.address || ''),
            symbol: body.symbol,
            launchpad: body.launchpad,
            curveProgress: body.curveProgress,
            createdAt: body.createdAt,
            observedAt: body.observedAt,
            holderCount: body.holderCount,
            buyVolumeUsd: body.buyVolumeUsd,
            graduated: body.graduated,
            migrated: body.migrated,
            devHoldingPct: body.devHoldingPct,
            bundleRate: body.bundleRate,
          };
          if (!input.address) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing required field "address"' }));
            return;
          }
          const result = evaluateLaunchIntelligence(input, body.options ?? {});
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, launch: result }));
          return;
        }

        // 7l. POST /api/exit/safety (deterministic exit pre-flight quote and veto)
        if (req.method === 'POST' && pathname === '/api/exit/safety') {
          const body = await parseJsonBody(req);
          const input: ExitSafetyInput = {
            chain: String(body.chain || 'unknown'),
            tokenAddress: String(body.address || body.tokenAddress || ''),
            symbol: body.symbol,
            priceUsd: body.priceUsd,
            positionAmount: body.positionAmount,
            amountFraction: body.amountFraction,
            liquidityUsd: body.liquidityUsd,
            volume24hUsd: body.volume24hUsd,
            buyTax: body.buyTax,
            sellTax: body.sellTax,
            averageTaxPct: body.averageTaxPct,
            highTaxPct: body.highTaxPct,
            canNotSell: body.canNotSell,
            isHoneypot: body.isHoneypot,
            creatorClose: body.creatorClose,
            creatorTokenStatus: body.creatorTokenStatus,
            bundlerRate: body.bundlerRate,
            rugRatio: body.rugRatio,
            top10HolderRate: body.top10HolderRate,
            smartDegenCount: body.smartDegenCount,
            priceChange1h: body.priceChange1h,
            bundleWave: body.bundleWave,
            sniperBuy: body.sniperBuy,
            bumpRatio: body.bumpRatio,
          };
          if (!input.tokenAddress) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing required field "address" or "tokenAddress"' }));
            return;
          }
          const result = evaluateExitSafety(input, body.options ?? {});
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, exitSafety: result }));
          return;
        }

        // 8. 404 Route Not Found
        res.statusCode = 404;
        res.end(JSON.stringify({ success: false, error: `Endpoint "${pathname}" not found.` }));

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, error: `Internal Server Error: ${errMsg}` }));
      }
    });

    this.server.listen(this.port, () => {
      console.log(`📡 OPENCATZ REST API Server listening on port ${this.port}`);
    });
  }
}

function parseJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(bodyStr ? JSON.parse(bodyStr) : {});
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

