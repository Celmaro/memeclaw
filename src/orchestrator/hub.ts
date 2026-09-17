import { RiskEngine, globalRiskEngine } from './risk-engine.js';
import { AGENT_DOMAINS, getAgentDomain, normalizeDomainKey as registryNormalizeDomain } from './agent-registry.js';
import type { AgentDomainId } from './agent-registry.js';
import type { AgentReport, ScreeningAgent } from '../agents/shared/agent-contract.js';

export interface ChannelStatus {
  channelId: string;
  domain: string;
  active: boolean;
  minLiquidityUsd: number;
}

export interface OpenCatzHubOptions {
  /** Optional per-domain agent factories (test DI / custom wiring). Lazy-imports real agents by default. */
  agentFactories?: Partial<Record<AgentDomainId, () => ScreeningAgent | Promise<ScreeningAgent>>>;
}

export class OpenCatzHub {
  private riskManager: RiskEngine;
  private channelStates: Map<string, ChannelStatus> = new Map();
  private agentStates: Map<string, boolean> = new Map();
  private autoExecuteStates: Map<string, { enabled: boolean; maxTradeAmount: number }> = new Map();

  private agentFactories: Partial<Record<AgentDomainId, () => ScreeningAgent | Promise<ScreeningAgent>>>;

  private stateStore?: any;

  constructor(options: OpenCatzHubOptions = {}) {
    this.riskManager = new RiskEngine();
    this.agentFactories = options.agentFactories ?? {};
    this.initializeAgentStatesDefaultActive();
  }

  /** Late wiring seam for composition roots (index.ts): share singleton agents with on-demand passes. */
  public attachAgentFactories(factories: Partial<Record<AgentDomainId, () => ScreeningAgent | Promise<ScreeningAgent>>>): void {
    this.agentFactories = { ...this.agentFactories, ...factories };
  }

  public attachStateStore(store: any): void {
    this.stateStore = store;
    const savedStates = store.getAllAgentStates ? store.getAllAgentStates() : {};
    const domains = AGENT_DOMAINS.map((d) => d.id);
    for (const d of domains) {
      const savedState = savedStates[d];
      // Default to true (ACTIVE) on startup unless explicitly paused by user
      const isActive = savedState !== undefined ? Boolean(savedState) : true;
      this.agentStates.set(d, isActive);
    }
    console.log(`[HUB] Sub-Agent persistent states synchronized. Active domains: [${this.getActiveDomains().join(', ') || 'NONE'}]`);
  }

  private initializeAgentStatesDefaultActive(): void {
    // All specialist sub-agents are ACTIVE by default for 24/7 autonomous intelligence
    const domains = AGENT_DOMAINS.map((d) => d.id);
    for (const d of domains) {
      this.agentStates.set(d, true);
      this.autoExecuteStates.set(d, { enabled: false, maxTradeAmount: 0.1 });
    }
  }

  public normalizeDomainKey(domain: string): string {
    return registryNormalizeDomain(domain);
  }

  public setAgentActive(domain: string, active: boolean): void {
    const norm = this.normalizeDomainKey(domain);
    this.agentStates.set(norm, active);
    if (this.stateStore && typeof this.stateStore.setAgentState === 'function') {
      this.stateStore.setAgentState(norm, active);
    }
    console.log(`[HUB] Sub-Agent "${norm.toUpperCase()}" status updated to: ${active ? '🟢 ACTIVE' : '🔴 PAUSED'}`);
  }

  public isAgentActive(domain: string): boolean {
    const norm = this.normalizeDomainKey(domain);
    return this.agentStates.get(norm) ?? false;
  }

  public setAutoExecute(domain: string, enabled: boolean, maxTradeAmount: number = 0.1): void {
    const norm = this.normalizeDomainKey(domain);
    this.autoExecuteStates.set(norm, { enabled, maxTradeAmount });
    console.log(`[HUB] Auto-Execution for "${norm.toUpperCase()}" set to: ${enabled ? '⚡ ENABLED' : '🔒 DISABLED'} (Max Size: ${maxTradeAmount})`);
  }

  public isAutoExecuteEnabled(domain: string): { enabled: boolean; maxTradeAmount: number } {
    const norm = this.normalizeDomainKey(domain);
    return this.autoExecuteStates.get(norm) ?? { enabled: false, maxTradeAmount: 0.1 };
  }

  public setAllAgentsActive(active: boolean): void {
    for (const key of this.agentStates.keys()) {
      this.agentStates.set(key, active);
    }
    console.log(`[HUB] All Sub-Agents status updated to: ${active ? '🟢 ACTIVE' : '🔴 PAUSED'}`);
  }

  public toggleChannelScreening(channelId: string, domain: string, active: boolean, minLiquidityUsd: number = 5000): ChannelStatus {
    const status: ChannelStatus = { channelId, domain, active, minLiquidityUsd };
    this.channelStates.set(channelId, status);
    this.setAgentActive(domain, active);
    return status;
  }

  public getActiveDomains(): string[] {
    const active: string[] = [];
    for (const [domain, isActive] of this.agentStates.entries()) {
      if (isActive) active.push(domain);
    }
    return active;
  }

  public getRiskManager(): RiskEngine {
    return this.riskManager;
  }

  public pauseAgent(domain: string): { agentId: string; active: boolean } {
    const key = domain.toLowerCase().trim();
    if (key === 'all') {
      this.setAllAgentsActive(false);
      return { agentId: 'all', active: false };
    }
    this.setAgentActive(key, false);
    return { agentId: key, active: false };
  }

  public resumeAgent(domain: string): { agentId: string; active: boolean } {
    const key = domain.toLowerCase().trim();
    if (key === 'all') {
      this.setAllAgentsActive(true);
      return { agentId: 'all', active: true };
    }
    this.setAgentActive(key, true);
    return { agentId: key, active: true };
  }

  public async triggerAgentPass(domain: string): Promise<AgentReport[]> {
    const key = domain.toLowerCase().trim();
    console.log(`[HUB] Triggering on-demand screening pass for: ${key.toUpperCase()}`);

    // Registry-driven resolution: canonical id, aliases, and channel names all resolve.
    const info = getAgentDomain(key);
    if (!info) {
      console.warn(`[HUB] Unknown screening domain "${key}" — no agent registered.`);
      return [];
    }

    try {
      // Explicit factory (test DI / custom wiring) wins over default flows.
      const factory = this.agentFactories[info.id];
      if (factory) {
        const agent = await factory();
        return await agent.runScreeningPass();
      }
      const agent = await this.resolveAgent(info.id);
      return await agent.runScreeningPass();
    } catch (err: any) {
      console.error(`[HUB SCREENING PASS ERROR] Failed for ${key}:`, err.message);
    }

    return [];
  }

  public async getScreeningAgent(domain: string): Promise<ScreeningAgent | null> {
    const info = getAgentDomain(domain);
    if (!info) return null;
    const factory = this.agentFactories[info.id];
    if (factory) return await factory();
    return null;
  }

  private async resolveAgent(id: AgentDomainId): Promise<ScreeningAgent> {
    switch (id) {
      case 'meme-solana': {
        const { SolanaScreeningAgent } = await import('../agents/meme-solana/solana-screening-agent.js');
        return new SolanaScreeningAgent();
      }
      case 'meme-robinhood': {
        const { RobinhoodScreeningAgent } = await import('../agents/meme-robinhood/robinhood-screening-agent.js');
        return new RobinhoodScreeningAgent({ chains: ['robinhood'] });
      }
      case 'meme-base': {
        const { BaseScreeningAgent } = await import('../agents/meme-base/base-screening-agent.js');
        return new BaseScreeningAgent();
      }
      case 'meme-eth': {
        const { EthScreeningAgent } = await import('../agents/meme-eth/eth-screening-agent.js');
        return new EthScreeningAgent();
      }
      case 'meme-bsc': {
        const { BscScreeningAgent } = await import('../agents/meme-bsc/bsc-screening-agent.js');
        return new BscScreeningAgent();
      }
      case 'ct-alpha': {
        const { CTAlphaAgent } = await import('../agents/ct-alpha/ct-alpha-agent.js');
        return new CTAlphaAgent(undefined, { emitCalls: true });
      }
      default:
        throw new Error(`No agent factory registered for domain "${id}"`);
    }
  }

  public getAgentStatuses(): Record<string, { active: boolean; autoExecute: boolean; maxTradeAmount: number }> {
    const statuses: Record<string, { active: boolean; autoExecute: boolean; maxTradeAmount: number }> = {};
    for (const [domain, active] of this.agentStates.entries()) {
      const autoExec = this.isAutoExecuteEnabled(domain);
      statuses[domain] = {
        active,
        autoExecute: autoExec.enabled,
        maxTradeAmount: autoExec.maxTradeAmount,
      };
    }
    return statuses;
  }

  public setRiskParameters(maxDrawdownPct?: number, maxPositionSizeUsd?: number): { maxDrawdownPct: number; maxPositionSizeUsd: number } {
    if (maxDrawdownPct !== undefined) {
      this.riskManager.setDrawdownLimit(maxDrawdownPct / 100);
    }
    if (maxPositionSizeUsd !== undefined) {
      this.riskManager.setMaxPositionSizeUsd(maxPositionSizeUsd);
    }

    const state = this.riskManager.getRiskState();
    return {
      maxDrawdownPct: state.maxDrawdownLimitPct,
      maxPositionSizeUsd: state.maxPositionSizeUsd,
    };
  }

  /**
   * Emergency One-Click Panic Command (/closeall)
   * Market-closes all positions and freezes all sub-agents & auto-execute states.
   */
  public executeEmergencyCloseAll(reason = 'User Manual Panic Button (/closeall)'): { closedPositionsCount: number; message: string } {
    console.error(`🚨 OPENCATZ HUB: EMERGENCY CLOSE ALL TRIGGERED! Reason: ${reason}`);
    
    // 1. Pause all sub-agents & disable auto-execute
    this.setAllAgentsActive(false);
    for (const key of this.autoExecuteStates.keys()) {
      this.autoExecuteStates.set(key, { enabled: false, maxTradeAmount: 0 });
    }

    // 2. Trigger Global Circuit Breaker Kill Switch
    globalRiskEngine.activateKillSwitch(reason);

    return {
      closedPositionsCount: 0, // Mock count of closed positions
      message: `🚨 Emergency Kill Switch Activated! All sub-agents PAUSED and trading locked. Reason: ${reason}`,
    };
  }
}

