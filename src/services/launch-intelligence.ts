import type {
  LaunchAssessment,
  LaunchCheck,
  LaunchIntelligenceInput,
  LaunchOptions,
  LaunchVerdict,
} from '../domain/launch-intelligence.js';

const LAUNCH_OPT_DEFAULTS: Required<LaunchOptions> = {
  targetFillPct: 0.5,
  slowFillMinutes: 180,
  fastFillMinutes: 2,
  stallProgressThreshold: 0.35,
  stallAfterMinutes: 120,
  minHolders: 50,
  minBuyVolumeUsd: 10_000,
  maxDevHoldingPct: 0.35,
  maxBundlerRate: 0.8,
  failClosedOnUnknown: true,
};

/**
 * Read-only launch intelligence borrowed from the qlo slow-graduation filter,
 * pumpfun-bonkfun graduation detection, and the bot/bundle heuristics from the
 * Meme Coin Factories paper. It never signs or broadcasts; it only classifies
 * launch state and curve-fill speed so scouts can feed deterministic evidence
 * into the gatebook and decision layer.
 */
export function evaluateLaunchIntelligence(
  input: LaunchIntelligenceInput,
  opts: LaunchOptions = {}
): LaunchAssessment {
  const o = { ...LAUNCH_OPT_DEFAULTS, ...opts };
  const checks: LaunchCheck[] = [];
  const symbol = (input.symbol || '').trim().toUpperCase();
  const chain = input.chain.trim().toLowerCase();
  const address = input.address.trim().toLowerCase();
  const unknown = (value: unknown): boolean => value === undefined || value === null;

  const minutesSinceLaunch = minutesBetween(input.createdAt, input.observedAt);
  const curveProgress = finite01(input.curveProgress);
  const fillPerHourPct = curveProgress !== null && minutesSinceLaunch !== null && minutesSinceLaunch > 0
    ? Math.min(100, Math.max(0, (curveProgress * 60 * 100) / minutesSinceLaunch))
    : null;

  const graduationState = input.migrated === true || input.graduated === true
    ? 'GRADUATED'
    : input.graduated === false
      ? 'BONDING'
      : 'UNKNOWN';

  if (typeof input.devHoldingPct === 'number' && Number.isFinite(input.devHoldingPct)) {
    addLaunchCheck(
      checks,
      'dev_hold',
      'Dev holding',
      input.devHoldingPct <= o.maxDevHoldingPct,
      input.devHoldingPct > o.maxDevHoldingPct,
      `dev holds ${(input.devHoldingPct * 100).toFixed(0)}%`,
      false
    );
  } else if (o.failClosedOnUnknown && unknown(input.devHoldingPct)) {
    addLaunchCheck(checks, 'dev_hold_unknown', 'Dev holding not reported', false, false, 'dev holding not reported');
  }

  if (typeof input.bundleRate === 'number' && Number.isFinite(input.bundleRate)) {
    addLaunchCheck(
      checks,
      'bundler',
      'Bundler rate',
      input.bundleRate <= o.maxBundlerRate,
      input.bundleRate > o.maxBundlerRate,
      `bundled ${(input.bundleRate * 100).toFixed(0)}%`,
      true
    );
  } else if (o.failClosedOnUnknown && unknown(input.bundleRate)) {
    addLaunchCheck(checks, 'bundler_unknown', 'Bundler rate not reported', false, false, 'bundler rate not reported');
  }

  if (typeof input.holderCount === 'number' && Number.isFinite(input.holderCount)) {
    addLaunchCheck(
      checks,
      'holders',
      'Holder count',
      input.holderCount >= o.minHolders,
      input.holderCount < o.minHolders,
      `${input.holderCount} holders`,
      false
    );
  }

  if (typeof input.buyVolumeUsd === 'number' && Number.isFinite(input.buyVolumeUsd)) {
    addLaunchCheck(
      checks,
      'buy_volume',
      'Buy volume',
      input.buyVolumeUsd >= o.minBuyVolumeUsd,
      input.buyVolumeUsd < o.minBuyVolumeUsd,
      `$${Math.round(input.buyVolumeUsd).toLocaleString()} buy volume`,
      false
    );
  }

  if (curveProgress !== null && minutesSinceLaunch !== null) {
    if (minutesSinceLaunch >= o.stallAfterMinutes && curveProgress < o.stallProgressThreshold) {
      addLaunchCheck(
        checks,
        'stall',
        'Curve stall',
        false,
        true,
        `curve stalled at ${(curveProgress * 100).toFixed(0)}% after ${minutesSinceLaunch}m`,
        false
      );
    } else if (curveProgress >= o.targetFillPct && minutesSinceLaunch < o.fastFillMinutes) {
      addLaunchCheck(
        checks,
        'fast_fill',
        'Fast curve fill',
        false,
        true,
        `curve filled too fast: ${(curveProgress * 100).toFixed(0)}% in ${minutesSinceLaunch}m`,
        true
      );
    } else {
      addLaunchCheck(
        checks,
        'curve',
        'Curve fill',
        true,
        false,
        `curve at ${(curveProgress * 100).toFixed(0)}% after ${minutesSinceLaunch}m`,
        false
      );
    }
  } else if (o.failClosedOnUnknown && (unknown(curveProgress) || unknown(minutesSinceLaunch))) {
    addLaunchCheck(
      checks,
      'curve_unknown',
      'Curve fill unknown',
      false,
      false,
      'curve progress or launch time not reported',
      false
    );
  }

  const failed = checks.filter((c) => !c.ok);
  const blocking = failed.filter((c) => c.blocking);
  const review = failed.filter((c) => !c.blocking);

  let verdict: LaunchVerdict;
  if (blocking.length > 0) {
    verdict = 'RISK';
  } else if (graduationState === 'GRADUATED') {
    verdict = 'HEALTHY';
  } else if (minutesSinceLaunch !== null && minutesSinceLaunch >= o.stallAfterMinutes && curveProgress !== null && curveProgress < o.stallProgressThreshold) {
    verdict = 'STALLED';
  } else if (curveProgress !== null && curveProgress >= o.targetFillPct) {
    verdict = 'SLOW';
  } else if (curveProgress === null || minutesSinceLaunch === null) {
    verdict = 'UNKNOWN';
  } else {
    verdict = 'SLOW';
  }

  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - blocking.length * 34 - review.length * 8 - (minutesSinceLaunch === null ? 20 : 0) - (curveProgress === null ? 20 : 0)))
  );
  const reasons = failed.map((c) => c.reason);

  return {
    chain,
    address,
    symbol,
    launchpad: (input.launchpad || '').trim().toLowerCase() || undefined,
    verdict,
    score,
    graduationState,
    curveProgress,
    minutesSinceLaunch,
    fillPerHourPct,
    checks,
    reasons,
    passedChecks: checks.filter((c) => c.ok).length,
    failedChecks: failed.length,
  };
}

export const globalLaunchIntelligence = {
  evaluate: evaluateLaunchIntelligence,
};

function addLaunchCheck(
  checks: LaunchCheck[],
  id: string,
  label: string,
  ok: boolean,
  blocking: boolean,
  reason: string,
  alwaysBlocking = false
): void {
  checks.push({
    id,
    label,
    ok,
    blocking: alwaysBlocking ? true : blocking,
    reason,
  });
  if (!ok && !alwaysBlocking) {
    const check = checks.find((c) => c.id === id);
    if (check) {
      check.blocking = false;
    }
  }
}

function minutesBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.max(0, Math.round((b - a) / 60_000));
}

function finite01(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
}
