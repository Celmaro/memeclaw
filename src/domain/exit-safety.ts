export type ExitSafetyVerdict = 'BLOCK' | 'WARN' | 'CLEAR';

export interface ExitQuote {
  markPriceUsd: number;
  quoteUsd: number;
  taxPct: number | null;
  slippageBps: number | null;
  depthUsd: number | null;
  depthCoverageUsd: number | null;
  estimatedProceedsUsd: number | null;
  blockedByDepth: boolean;
}

export interface ExitSafetyInput {
  chain: string;
  tokenAddress: string;
  symbol?: string;
  priceUsd?: number | null;
  positionAmount?: number | null;
  amountFraction?: number | null;
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
  buyTax?: string | number | null;
  sellTax?: string | number | null;
  averageTaxPct?: number | null;
  highTaxPct?: number | null;
  canNotSell?: boolean | null;
  isHoneypot?: boolean | null;
  creatorClose?: boolean | null;
  creatorTokenStatus?: string | null;
  bundlerRate?: number | null;
  rugRatio?: number | null;
  top10HolderRate?: number | null;
  smartDegenCount?: number | null;
  priceChange1h?: number | null;
  bundleWave?: number | null;
  sniperBuy?: boolean | null;
  bumpRatio?: number | null;
}

export interface ExitSafetyOptions {
  maxTaxPct?: number;
  maxBundlerRate?: number;
  maxRugRatio?: number;
  minLiquidityUsdForExit?: number;
  minVolume24hUsdForExit?: number;
  maxSlippageBps?: number;
  failClosedOnUnknownSell?: boolean;
  failClosedOnUnknownHoneypot?: boolean;
}

export interface ExitSafetyCheck {
  id: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  severity: 'hard' | 'warn';
  reason: string;
}

export interface ExitSafetyResult {
  chain: string;
  address: string;
  symbol: string;
  verdict: ExitSafetyVerdict;
  quote: ExitQuote | null;
  checks: ExitSafetyCheck[];
  reasons: string[];
  passedChecks: number;
  failedChecks: number;
}
