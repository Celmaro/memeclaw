export type GatebookVerdict = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface TokenGatebookInput {
  chain: string;
  address: string;
  symbol?: string;
  mintAuthorityActive?: boolean | null;
  freezeAuthorityActive?: boolean | null;
  isHoneypot?: boolean | null;
  isWashTrading?: boolean | null;
  taxPct?: number | null;
  top10HolderRate?: number | null;
  bundlerRate?: number | null;
  lpLockedPct?: number | null;
  isGraduated?: boolean | null;
  devTeamHoldRate?: number | null;
  holderCount?: number | null;
  minLiquidityUsd?: number | null;
  marketCapUsd?: number | null;
  volume24hUsd?: number | null;
}

export interface GatebookOptions {
  maxTaxPct?: number;
  maxTop10HolderRate?: number;
  maxBundlerRate?: number;
  minLockedLpPct?: number;
  minMarketCapUsd?: number;
  minVolume24hUsd?: number;
  failClosedOnUnknown?: boolean;
}

export interface GatebookCheck {
  id: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  reason: string;
}

export interface GatebookResult {
  chain: string;
  address: string;
  symbol: string;
  verdict: GatebookVerdict;
  score: number;
  checks: GatebookCheck[];
  reasons: string[];
  passedChecks: number;
  failedChecks: number;
  reviewCount: number;
}
