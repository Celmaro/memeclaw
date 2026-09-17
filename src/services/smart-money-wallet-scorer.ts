export interface SmartWalletTrade {
  side: 'buy' | 'sell' | 'unknown';
  tokenAddress?: string;
  tokenSymbol?: string;
  amountUsd?: number;
  realizedPnlUsd?: number;
  holdDurationMs?: number;
  timestamp?: number;
}

export interface SmartWalletPnlSnapshot {
  label: string;
  roiPercent: number;
  sampleSize?: number;
}

export interface SmartWalletScoreInput {
  wallet: string;
  chain?: string;
  trades?: SmartWalletTrade[];
  pnlSnapshots?: SmartWalletPnlSnapshot[];
  profileLabels?: string[];
}

export interface WalletScoreDetail {
  tradeCount: number;
  winCount: number;
  lossCount: number;
  wilsonWinRate: number;
  grossRoiPercent: number;
  uniqueTokens: number;
  medianHoldMs: number;
  redFlags: string[];
  reasons: string[];
}

export interface SmartWalletScore {
  wallet: string;
  chain: string;
  score: number;
  grade: 'FIRE' | 'WATCH' | 'NOISE' | 'UNKNOWN';
  detail: WalletScoreDetail;
}

function wilsonLowerBound(wins: number, losses: number, z = 1.96): number {
  const n = wins + losses;
  if (n === 0) return 0;
  const phat = wins / n;
  const denom = 1 + z * z / n;
  const center = (phat + z * z / (2 * n)) / denom;
  const margin = (z * Math.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n))) / denom;
  return Math.max(0, center - margin);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Deterministic smart-money wallet admission scorer borrowed from the study
 * corpus: akanz/onchain-trading-bot's admission logic, MEERKAT's evidence-first
 * wallet dossiers, and the red-flag checks from fomo-robinhood-radar. No LLM,
 * no signing, no broadcast. It only tells the rest of the pipeline how much
 * evidence a wallet has earned.
 */
export class SmartMoneyWalletScorer {
  public score(input: SmartWalletScoreInput): SmartWalletScore {
    const chain = (input.chain || 'unknown').toLowerCase();
    const trades = input.trades ?? [];
    const settled = trades.filter((t) => typeof t.realizedPnlUsd === 'number' && Number.isFinite(t.realizedPnlUsd));
    const wins = settled.filter((t) => (t.realizedPnlUsd ?? 0) > 0).length;
    const losses = settled.filter((t) => (t.realizedPnlUsd ?? 0) < 0).length;
    const grossRoi = settled.length > 0
      ? (settled.reduce((sum, t) => sum + (t.realizedPnlUsd ?? 0), 0) / Math.max(1, settled.length)) * 100
      : 0;
    const wilson = wilsonLowerBound(wins, losses);
    const uniqueTokens = new Set(trades.map((t) => t.tokenAddress?.toLowerCase()).filter(Boolean)).size;
    const holds = trades.map((t) => t.holdDurationMs).filter((v): v is number => typeof v === 'number' && v >= 0);
    const medianHoldMs = median(holds);
    const snapshots = (input.pnlSnapshots ?? []).filter((s) => Number.isFinite(s.roiPercent));
    const snapshotMeanRoi = snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + s.roiPercent, 0) / snapshots.length
      : 0;

    const redFlags: string[] = [];
    const reasons: string[] = [];
    if (trades.length > 0 && uniqueTokens > 0 && uniqueTokens / trades.length < 0.25) {
      redFlags.push('bot_like_inventory_rotation');
    }
    if (holds.length >= 5 && medianHoldMs < 2 * 60 * 1000) {
      redFlags.push('median_hold_too_short');
    }
    if (trades.length > 200 && grossRoi < 0) {
      redFlags.push('high_frequency_net_loser');
    }

    let score = 0;
    score += wilson * 45;
    score += Math.max(0, Math.min(1, grossRoi / 50)) * 30;
    score += Math.max(0, Math.min(1, snapshotMeanRoi / 100)) * 20;
    score += Math.min(10, trades.length / 10) * 10;
    score += Math.min(15, uniqueTokens * 3);
    score += Math.min(5, holds.length > 0 ? 1 : 0) * 5;
    score -= redFlags.length * 12;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const grade = score >= 70 ? 'FIRE' : score >= 45 ? 'WATCH' : score > 0 ? 'NOISE' : 'UNKNOWN';
    if (grade === 'FIRE') reasons.push('high_confidence_smart_money');
    if (grade === 'WATCH') reasons.push('enough_evidence_but_not_fire');
    if (grade === 'NOISE') reasons.push('weak_evidence_profile');
    if (redFlags.length > 0) reasons.push(`refused_by:${redFlags.join(',')}`);

    return {
      wallet: input.wallet.toLowerCase(),
      chain,
      score,
      grade,
      detail: {
        tradeCount: trades.length,
        winCount: wins,
        lossCount: losses,
        wilsonWinRate: Math.round(wilson * 10000) / 100,
        grossRoiPercent: Math.round(grossRoi * 100) / 100,
        uniqueTokens,
        medianHoldMs: Math.round(medianHoldMs),
        redFlags,
        reasons,
      },
    };
  }
}

export const globalSmartMoneyWalletScorer = new SmartMoneyWalletScorer();
