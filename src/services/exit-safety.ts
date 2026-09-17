import type {
  ExitSafetyCheck,
  ExitSafetyInput,
  ExitSafetyOptions,
  ExitSafetyResult,
  ExitSafetyVerdict,
  ExitQuote,
} from '../domain/exit-safety.js';

const EXIT_SAFETY_DEFAULTS: Required<ExitSafetyOptions> = {
  maxTaxPct: 15,
  maxBundlerRate: 0.8,
  maxRugRatio: 0.5,
  minLiquidityUsdForExit: 10_000,
  minVolume24hUsdForExit: 20_000,
  maxSlippageBps: 1_500,
  failClosedOnUnknownSell: true,
  failClosedOnUnknownHoneypot: true,
};

const LIQUIDITY_DEPTH_RATIO_BLOCK = 0.25;

/**
 * Deterministic exit pre-flight borrowed from loxley: a separate exit quote,
 * tax/slippage/depth checks, and launch-time bundle/block-0 sirens run before
 * any sell order can be marked executable. This module is read-only and never
 * signs or broadcasts. The LLM can explain a bad quote; it cannot override it.
 */
export function evaluateExitSafety(
  input: ExitSafetyInput,
  opts: ExitSafetyOptions = {}
): ExitSafetyResult {
  const o = { ...EXIT_SAFETY_DEFAULTS, ...opts };
  const checks: ExitSafetyCheck[] = [];
  const chain = input.chain.trim().toLowerCase();
  const address = input.tokenAddress.trim().toLowerCase();
  const symbol = (input.symbol || '').trim().toUpperCase();
  const isNull = (v: unknown): boolean => v === undefined || v === null;
  const known = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

  const sellTaxPct = parseTaxPct(input.sellTax);
  const buyTaxPct = parseTaxPct(input.buyTax);
  const taxPct = pickTaxPct(o.maxTaxPct, input.averageTaxPct, input.highTaxPct, sellTaxPct, buyTaxPct);
  const priceUsd = known(input.priceUsd) && input.priceUsd > 0 ? input.priceUsd : null;
  const positionAmount = known(input.positionAmount) && input.positionAmount > 0 ? input.positionAmount : null;
  const amountFraction = known(input.amountFraction)
    ? Math.max(0, Math.min(1, input.amountFraction))
    : 1;

  const sellLocked = input.canNotSell === true || input.isHoneypot === true;
  const sellUnknown = isNull(input.canNotSell) && isNull(input.isHoneypot) && o.failClosedOnUnknownSell;
  addCheck(
    checks,
    'sell_locked',
    'Sell lock',
    !sellLocked && !sellUnknown,
    sellLocked
      ? 'token cannot be sold or is a confirmed honeypot'
      : sellUnknown
        ? 'sell lock status not reported'
        : 'sell path is open',
    sellLocked ? 'hard' : sellUnknown ? 'warn' : 'hard'
  );

  const honeypot = input.isHoneypot === true;
  const honeypotUnknown = isNull(input.isHoneypot) && o.failClosedOnUnknownHoneypot;
  addCheck(
    checks,
    'honeypot',
    'Honeypot',
    !honeypot && !honeypotUnknown,
    honeypot
      ? 'confirmed honeypot'
      : honeypotUnknown
        ? 'honeypot status not reported'
        : 'not flagged as honeypot',
    honeypot ? 'hard' : honeypotUnknown ? 'warn' : 'hard'
  );

  const creatorClosed = input.creatorClose === true || input.creatorTokenStatus === 'creator_close';
  addCheck(
    checks,
    'creator_close',
    'Creator close',
    !creatorClosed,
    creatorClosed
      ? 'creator/dev wallet closed their position'
      : 'creator wallet still open',
    'hard'
  );

  if (known(input.bundlerRate)) {
    const bundlerHigh = input.bundlerRate > o.maxBundlerRate;
    addCheck(
      checks,
      'bundler',
      'Bundler rate',
      !bundlerHigh,
      bundlerHigh
        ? `bundler rate ${(input.bundlerRate * 100).toFixed(0)}% above ${(o.maxBundlerRate * 100).toFixed(0)}%`
        : `bundler rate ${(input.bundlerRate * 100).toFixed(0)}%`,
      'hard'
    );
  } else {
    addCheck(checks, 'bundler_unknown', 'Bundler rate unknown', false, 'bundler rate not reported', 'warn');
  }

  if (known(input.rugRatio)) {
    const rugHigh = input.rugRatio > o.maxRugRatio;
    addCheck(
      checks,
      'rug_ratio',
      'Rug ratio',
      !rugHigh,
      rugHigh
        ? `rug ratio ${(input.rugRatio * 100).toFixed(0)}% above ${(o.maxRugRatio * 100).toFixed(0)}%`
        : `rug ratio ${(input.rugRatio * 100).toFixed(0)}%`,
      'hard'
    );
  }

  if (known(taxPct)) {
    const taxHigh = taxPct > o.maxTaxPct;
    addCheck(
      checks,
      'tax',
      'Exit tax',
      !taxHigh,
      taxHigh
        ? `exit tax ${taxPct.toFixed(1)}% above ${o.maxTaxPct.toFixed(0)}%`
        : `exit tax ${taxPct.toFixed(1)}%`,
      'hard'
    );
  } else {
    addCheck(checks, 'tax_unknown', 'Exit tax unknown', false, 'tax not reported; quote uses 0% estimate', 'warn');
  }

  const liquidityUsd = known(input.liquidityUsd) ? input.liquidityUsd : null;
  if (liquidityUsd === null) {
    addCheck(checks, 'depth_unknown', 'Liquidity depth unknown', false, 'liquidity depth not reported', 'warn');
  } else if (liquidityUsd < o.minLiquidityUsdForExit) {
    addCheck(
      checks,
      'depth_low',
      'Liquidity depth low',
      false,
      `depth $${Math.round(liquidityUsd).toLocaleString()} below $${o.minLiquidityUsdForExit.toLocaleString()}`,
      'warn'
    );
  } else {
    addCheck(checks, 'depth_ok', 'Liquidity depth', true, `depth $${Math.round(liquidityUsd).toLocaleString()}`, 'hard');
  }

  if (known(input.volume24hUsd) && input.volume24hUsd < o.minVolume24hUsdForExit) {
    addCheck(checks, 'volume_dry', 'Exit volume dry', false, `24h volume $${Math.round(input.volume24hUsd).toLocaleString()}`, 'warn');
  }

  if (known(input.priceChange1h) && input.priceChange1h <= -30) {
    addCheck(checks, 'hour_crash', '1h price crash', false, `1h change ${input.priceChange1h.toFixed(1)}%`, 'warn');
  }

  if (known(input.smartDegenCount) && input.smartDegenCount === 0) {
    addCheck(checks, 'smart_zero', 'Smart money absent', false, 'smart-money holders are absent', 'warn');
  }

  if (input.bundleWave !== undefined && input.bundleWave !== null && Number(input.bundleWave) > 0) {
    addCheck(checks, 'bundle_wave', 'Launch bundle wave', false, `bundle wave ${input.bundleWave} buys in launch block`, 'hard');
  }
  if (input.sniperBuy === true) {
    addCheck(checks, 'sniper_buy', 'Sniper launch buy', false, 'non-creator sniper buys detected in first blocks', 'hard');
  }
  if (known(input.bumpRatio) && input.bumpRatio >= 0.5) {
    addCheck(checks, 'bump_bot', 'Bump bot ratio', false, `bump ratio ${(input.bumpRatio * 100).toFixed(0)}%`, 'hard');
  }

  const quote = buildExitQuote({
    priceUsd,
    positionAmount,
    amountFraction,
    taxPct,
    liquidityUsd,
    maxSlippageBps: o.maxSlippageBps,
    failClosedOnUnknownDepth: liquidityUsd === null,
  });

  attachQuoteChecks(checks, quote, o.maxSlippageBps);

  const failed = checks.filter((c) => !c.ok);
  const blocked = failed.some((c) => c.severity === 'hard');
  const verdict: ExitSafetyVerdict = blocked ? 'BLOCK' : failed.length > 0 ? 'WARN' : 'CLEAR';
  const reasons = failed.map((c) => c.reason);

  return {
    chain,
    address,
    symbol,
    verdict,
    quote,
    checks,
    reasons,
    passedChecks: checks.filter((c) => c.ok).length,
    failedChecks: failed.length,
  };
}

export const globalExitSafety = {
  evaluate: evaluateExitSafety,
};

function buildExitQuote(args: {
  priceUsd: number | null;
  positionAmount: number | null;
  amountFraction: number;
  taxPct: number | null;
  liquidityUsd: number | null;
  maxSlippageBps: number;
  failClosedOnUnknownDepth: boolean;
}): ExitQuote | null {
  if (!args.priceUsd || !args.positionAmount) return null;
  const quoteUsd = args.priceUsd * args.positionAmount * args.amountFraction;
  const depthUsd = args.liquidityUsd;
  const ratio = depthUsd && depthUsd > 0 ? quoteUsd / depthUsd : null;
  let slippageBps: number | null = null;
  let blockedByDepth = false;
  if (ratio !== null) {
    slippageBps = Math.min(10_000, Math.round(ratio * 10_000));
    blockedByDepth = ratio > LIQUIDITY_DEPTH_RATIO_BLOCK;
  } else if (args.failClosedOnUnknownDepth) {
    blockedByDepth = true;
  }
  const taxPct = args.taxPct ?? 0;
  const slippagePct = (slippageBps ?? 0) / 10_000;
  const estimatedProceedsUsd = quoteUsd * (1 - taxPct / 100) * (1 - slippagePct);
  return {
    markPriceUsd: args.priceUsd,
    quoteUsd,
    taxPct: args.taxPct,
    slippageBps,
    depthUsd,
    depthCoverageUsd: depthUsd !== null ? Math.max(0, depthUsd - quoteUsd) : null,
    estimatedProceedsUsd,
    blockedByDepth,
  };
}

function attachQuoteChecks(checks: ExitSafetyCheck[], quote: ExitQuote | null, maxSlippageBps: number): void {
  if (!quote) {
    addCheck(checks, 'quote_unavailable', 'Exit quote unavailable', false, 'missing price or amount', 'warn');
    return;
  }
  if (quote.depthCoverageUsd === null) {
    addCheck(checks, 'quote_depth_unknown', 'Exit depth unknown', false, 'cannot size quote against depth', 'warn');
    return;
  }
  if (quote.depthCoverageUsd <= 0) {
    addCheck(checks, 'quote_over_depth', 'Exit exceeds liquidity depth', false, `quote $${Math.round(quote.quoteUsd).toLocaleString()} exceeds available depth`, 'hard');
    return;
  }
  if (quote.slippageBps !== null && quote.slippageBps > maxSlippageBps) {
    addCheck(checks, 'quote_slippage', 'Exit slippage high', false, `est slippage ${quote.slippageBps} bps above ${maxSlippageBps}`, 'warn');
  } else {
    addCheck(checks, 'quote_slippage_ok', 'Exit slippage', true, quote.slippageBps !== null ? `est slippage ${quote.slippageBps} bps` : 'slippage not estimated', 'hard');
  }
}

function addCheck(
  checks: ExitSafetyCheck[],
  id: string,
  label: string,
  ok: boolean,
  reason: string,
  severity: 'hard' | 'warn',
  blocking = !ok && severity === 'hard'
): void {
  checks.push({ id, label, ok, blocking, severity, reason });
}

function parseTaxPct(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

function pickTaxPct(
  max: number,
  averageTaxPct: number | null | undefined,
  highTaxPct: number | null | undefined,
  sellTaxPct: number | null,
  buyTaxPct: number | null
): number | null {
  const taxValues = [averageTaxPct, highTaxPct, sellTaxPct, buyTaxPct]
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .filter((v) => v > 0);
  if (taxValues.length === 0) return null;
  return Math.min(max, Math.max(...taxValues));
}
