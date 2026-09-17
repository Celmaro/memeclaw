export type RiskDecisionType = 'ALLOW' | 'PAPER_ONLY' | 'WATCH' | 'REJECT';
export type RiskDecisionAuthority = 'algorithm' | 'human' | 'system';

export interface RiskDecision {
  decisionId: string;
  decisionType: RiskDecisionType;
  reason: string;
  policyVersion: string;
  decidedBy: RiskDecisionAuthority;
  gates: Record<string, boolean | number | string>;
  expiresAt?: string;
}

export function isExecutableDecision(decision: RiskDecision, now = Date.now()): boolean {
  if (decision.decisionType !== 'ALLOW') return false;
  if (decision.expiresAt && Date.parse(decision.expiresAt) <= now) return false;
  return true;
}
