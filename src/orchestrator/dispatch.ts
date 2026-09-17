import type { CallCardPayload } from '../agents/shared/agent-contract.js';
import type { MeteoraPoolSignal } from '../adapters/meteora-dlmm-adapter.js';

export interface DispatchedSignal {
  channelName: string;
  payload: any;
  rawReason: string;
}

export interface NormalizedReport {
  passed: boolean;
  signal: any;
  reason: string;
  confidence?: number;
  payload?: CallCardPayload;
}

export interface DispatchDomainOptions {
  domain: string;
  channelName: string;
  isActive: () => boolean;
  runPass: () => Promise<NormalizedReport[]>;
  keyReady: () => { ready: boolean; statusMessage: string };
  buildPayload?: (entry: { signal: any; reason: string }) => any;
  onHalt?: (domain: string, statusMessage: string) => void;
}

export async function dispatchDomain(opts: DispatchDomainOptions): Promise<DispatchedSignal[]> {
  // This bot is intentionally limited to memecoin trading plus the CT Alpha
  // intelligence scout. LP, NFT, prediction and perps are no longer dispatched.
  if (!opts.domain.startsWith('meme-') && opts.domain !== 'ct-alpha') return [];
  if (!opts.isActive()) return [];
  const keyCheck = opts.keyReady();
  if (!keyCheck.ready) {
    console.warn(keyCheck.statusMessage);
    if (opts.onHalt) {
      try { opts.onHalt(opts.domain, keyCheck.statusMessage); } catch (e: any) {
        console.warn(`[DISPATCH] onHalt notification failed for ${opts.domain}: ${e.message}`);
      }
    }
    return [];
  }
  const reports = await opts.runPass();
  const out: DispatchedSignal[] = [];
  for (const r of reports) {
    if (r.passed && r.signal) {
      out.push({
        channelName: opts.channelName,
        rawReason: r.reason || '',
        payload: opts.buildPayload
          ? opts.buildPayload({ signal: r.signal, reason: r.reason || '' })
          : r.payload || {},
      });
    }
  }
  return out;
}

// Kept only for source compatibility with legacy files left outside the active
// runtime. LP domains are blocked above and are not registered or dispatched.
export function buildLPPayload(pool: MeteoraPoolSignal): CallCardPayload {
  return {
    domain: 'LP_METEORA',
    title: pool.pairName,
    symbol: pool.pairName.split(' ')[0],
    contractAddress: pool.poolAddress,
    network: 'Solana',
    aiThesis: pool.aiRecommendation,
    confidenceScore: 80,
    securityAuditPassed: true,
    socialHypeScore: pool.organicVolumeScore1h || 0,
    liquidityUsd: pool.tvlUsd || 0,
    volume1hUsd: pool.volume1hUsd || 0,
  };
}
