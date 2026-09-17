import type {
  GatebookCheck,
  GatebookOptions,
  GatebookResult,
  GatebookVerdict,
  TokenGatebookInput,
} from '../domain/token-gatebook.js';

const GATEBOOK_DEFAULTS: Required<GatebookOptions> = {
  maxTaxPct: 10,
  maxTop10HolderRate: 0.4,
  maxBundlerRate: 0.8,
  minLockedLpPct: 0.5,
  minMarketCapUsd: 50_000,
  minVolume24hUsd: 50_000,
  failClosedOnUnknown: true,
};

/**
 * Deterministic token gatebook borrowed from the AEGIS pattern: mint/freeze,
 * concentrated holders, bundles, LP lock, metadata/honeypot, and wash trading
 * are hard controls that no LLM can bypass. Unknown critical fields become
 * REVIEW (never a silent ALLOW), while observed risk becomes a hard BLOCK.
 * This module is read-only and has no signing or broadcast path.
 */
export function evaluateTokenGatebook(
  input: TokenGatebookInput,
  opts: GatebookOptions = {}
): GatebookResult {
  const o = { ...GATEBOOK_DEFAULTS, ...opts };
  const checks: GatebookCheck[] = [];
  const unknownOrNull = (value: unknown): boolean => value === undefined || value === null;

  addHardCheck(
    checks,
    'mint_authority',
    'Mint authority active',
    input.mintAuthorityActive === true,
    input.mintAuthorityActive !== true,
    input.mintAuthorityActive === true
      ? 'mint authority is live'
      : unknownOrNull(input.mintAuthorityActive)
        ? o.failClosedOnUnknown
          ? 'mint authority not reported'
          : reviewReason('mint authority not reported')
        : 'mint authority is disabled or burned',
    o.failClosedOnUnknown && unknownOrNull(input.mintAuthorityActive)
  );
  addHardCheck(
    checks,
    'freeze_authority',
    'Freeze authority active',
    input.freezeAuthorityActive === true,
    input.freezeAuthorityActive !== true,
    input.freezeAuthorityActive === true
      ? 'freeze authority is live'
      : unknownOrNull(input.freezeAuthorityActive)
        ? o.failClosedOnUnknown
          ? 'freeze authority not reported'
          : reviewReason('freeze authority not reported')
        : 'freeze authority is disabled or burned',
    o.failClosedOnUnknown && unknownOrNull(input.freezeAuthorityActive)
  );
  addHardCheck(
    checks,
    'honeypot',
    'Honeypot',
    input.isHoneypot === true,
    input.isHoneypot !== true,
    input.isHoneypot === true
      ? 'honeypot confirmed'
      : unknownOrNull(input.isHoneypot)
        ? o.failClosedOnUnknown
          ? 'honeypot status not reported'
          : reviewReason('honeypot status not reported')
        : 'not a honeypot',
    o.failClosedOnUnknown && unknownOrNull(input.isHoneypot)
  );
  addHardCheck(
    checks,
    'wash_trading',
    'Wash trading',
    input.isWashTrading === true,
    input.isWashTrading !== true,
    input.isWashTrading === true
      ? 'wash trading confirmed'
      : unknownOrNull(input.isWashTrading)
        ? o.failClosedOnUnknown
          ? 'wash trading status not reported'
          : reviewReason('wash trading status not reported')
        : 'no wash trading signal',
    o.failClosedOnUnknown && unknownOrNull(input.isWashTrading)
  );

  if (typeof input.taxPct === 'number' && Number.isFinite(input.taxPct)) {
    addHardCheck(
      checks,
      'tax',
      'Total tax',
      input.taxPct > o.maxTaxPct,
      input.taxPct <= o.maxTaxPct,
      `tax ${input.taxPct}% ${input.taxPct > o.maxTaxPct ? '>' : '<='} ${o.maxTaxPct}%`,
      false
    );
  } else if (o.failClosedOnUnknown && unknownOrNull(input.taxPct)) {
    addReviewCheck(checks, 'tax_unknown', 'Tax not reported');
  }

  if (typeof input.top10HolderRate === 'number' && Number.isFinite(input.top10HolderRate)) {
    addHardCheck(
      checks,
      'top10_holder',
      'Top-10 holder concentration',
      input.top10HolderRate > o.maxTop10HolderRate,
      input.top10HolderRate <= o.maxTop10HolderRate,
      `top-10 holders ${(input.top10HolderRate * 100).toFixed(0)}% ${input.top10HolderRate > o.maxTop10HolderRate ? '>' : '<='} ${(o.maxTop10HolderRate * 100).toFixed(0)}%`,
      false
    );
  } else if (o.failClosedOnUnknown && unknownOrNull(input.top10HolderRate)) {
    addReviewCheck(checks, 'top10_unknown', 'Top-10 holder concentration not reported');
  }

  if (typeof input.bundlerRate === 'number' && Number.isFinite(input.bundlerRate)) {
    addHardCheck(
      checks,
      'bundler',
      'Bundler rate',
      input.bundlerRate > o.maxBundlerRate,
      input.bundlerRate <= o.maxBundlerRate,
      `bundled ${(input.bundlerRate * 100).toFixed(0)}% ${input.bundlerRate > o.maxBundlerRate ? '>' : '<='} ${(o.maxBundlerRate * 100).toFixed(0)}%`,
      false
    );
  } else if (o.failClosedOnUnknown && unknownOrNull(input.bundlerRate)) {
    addReviewCheck(checks, 'bundler_unknown', 'Bundler rate not reported');
  }

  if (typeof input.lpLockedPct === 'number' && Number.isFinite(input.lpLockedPct)) {
    addHardCheck(
      checks,
      'lp_lock',
      'LP lock',
      input.lpLockedPct < o.minLockedLpPct,
      input.lpLockedPct >= o.minLockedLpPct,
      `LP locked ${(input.lpLockedPct * 100).toFixed(0)}% ${input.lpLockedPct < o.minLockedLpPct ? '<' : '>='} ${(o.minLockedLpPct * 100).toFixed(0)}%`,
      false
    );
  } else if (o.failClosedOnUnknown && unknownOrNull(input.lpLockedPct)) {
    addReviewCheck(checks, 'lp_lock_unknown', 'LP lock not reported');
  }

  if (input.isGraduated === false) {
    addHardCheck(checks, 'graduated', 'Graduated to DEX', true, false, 'still on bonding curve', false);
  } else if (unknownOrNull(input.isGraduated)) {
    addReviewCheck(checks, 'graduated_unknown', 'Graduation status not reported');
  } else {
    addHardCheck(checks, 'graduated', 'Graduated to DEX', false, true, 'graduated token', false);
  }

  if (typeof input.devTeamHoldRate === 'number' && Number.isFinite(input.devTeamHoldRate)) {
    if (input.devTeamHoldRate > 0.35) {
      addReviewCheck(checks, 'dev_team_hold', `Dev team still holds ${(input.devTeamHoldRate * 100).toFixed(0)}%`);
    } else {
      addPassCheck(checks, 'dev_team_hold', `Dev team holds ${(input.devTeamHoldRate * 100).toFixed(0)}%`);
    }
  }

  if (typeof input.marketCapUsd === 'number' && Number.isFinite(input.marketCapUsd)) {
    if (input.marketCapUsd < o.minMarketCapUsd) {
      addReviewCheck(checks, 'market_cap_low', `market cap $${input.marketCapUsd.toLocaleString()} below $${o.minMarketCapUsd.toLocaleString()}`);
    } else {
      addPassCheck(checks, 'market_cap', `market cap $${Math.round(input.marketCapUsd).toLocaleString()}`);
    }
  }

  if (typeof input.volume24hUsd === 'number' && Number.isFinite(input.volume24hUsd)) {
    if (input.volume24hUsd < o.minVolume24hUsd) {
      addReviewCheck(checks, 'volume_low', `24h volume $${input.volume24hUsd.toLocaleString()} below $${o.minVolume24hUsd.toLocaleString()}`);
    } else {
      addPassCheck(checks, 'volume', `24h volume $${Math.round(input.volume24hUsd).toLocaleString()}`);
    }
  }

  const failedChecks = checks.filter((c) => !c.ok);
  const blocking = failedChecks.filter((c) => c.blocking);
  const reviewChecks = failedChecks.filter((c) => !c.blocking);
  const verdict: GatebookVerdict = blocking.length > 0 ? 'BLOCK' : reviewChecks.length > 0 ? 'REVIEW' : 'ALLOW';
  const score = Math.max(0, Math.min(100, Math.round(100 - blocking.length * 50 - reviewChecks.length * 10)));
  const reasons = failedChecks.map((c) => c.reason);

  return {
    chain: input.chain.trim().toLowerCase(),
    address: input.address.trim().toLowerCase(),
    symbol: (input.symbol || '').trim().toUpperCase(),
    verdict,
    score,
    checks,
    reasons,
    passedChecks: checks.filter((c) => c.ok).length,
    failedChecks: failedChecks.length,
    reviewCount: reviewChecks.length,
  };
}

export const globalTokenGatebook = {
  evaluate: evaluateTokenGatebook,
};

function addHardCheck(
  checks: GatebookCheck[],
  id: string,
  label: string,
  hardFailure: boolean,
  ok: boolean,
  reason: string,
  reviewWhenUnknown: boolean
): void {
  checks.push({
    id,
    label,
    ok,
    blocking: hardFailure,
    reason,
  });
  if (reviewWhenUnknown && ok) {
    const review = checks.find((c) => c.id === id);
    if (review) {
      review.ok = false;
      review.blocking = false;
      review.reason = `${review.reason}; requires review`;
    }
  }
}

function addReviewCheck(checks: GatebookCheck[], id: string, reason: string): void {
  checks.push({ id, label: reason, ok: false, blocking: false, reason });
}

function addPassCheck(checks: GatebookCheck[], id: string, label: string): void {
  checks.push({ id, label, ok: true, blocking: false, reason: label });
}

function reviewReason(reason: string): string {
  return `${reason}; requires review`;
}
