export type LaunchVerdict = 'HEALTHY' | 'RISK' | 'SLOW' | 'STALLED' | 'UNKNOWN';
export type GraduationState = 'BONDING' | 'GRADUATED' | 'UNKNOWN';

export interface LaunchIntelligenceInput {
  chain: string;
  address: string;
  symbol?: string;
  launchpad?: string;
  curveProgress?: number | null;
  createdAt?: string;
  observedAt?: string;
  holderCount?: number | null;
  buyVolumeUsd?: number | null;
  graduated?: boolean | null;
  migrated?: boolean | null;
  devHoldingPct?: number | null;
  bundleRate?: number | null;
}

export interface LaunchOptions {
  targetFillPct?: number;
  slowFillMinutes?: number;
  fastFillMinutes?: number;
  stallProgressThreshold?: number;
  stallAfterMinutes?: number;
  minHolders?: number;
  minBuyVolumeUsd?: number;
  maxDevHoldingPct?: number;
  maxBundlerRate?: number;
  failClosedOnUnknown?: boolean;
}

export interface LaunchCheck {
  id: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  reason: string;
}

export interface LaunchAssessment {
  chain: string;
  address: string;
  symbol: string;
  launchpad?: string;
  verdict: LaunchVerdict;
  score: number;
  graduationState: GraduationState;
  curveProgress: number | null;
  minutesSinceLaunch: number | null;
  fillPerHourPct: number | null;
  checks: LaunchCheck[];
  reasons: string[];
  passedChecks: number;
  failedChecks: number;
}
