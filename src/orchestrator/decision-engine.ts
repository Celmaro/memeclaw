import type { RiskDecision } from '../domain/risk-decision.js';
import { isExecutableDecision } from '../domain/risk-decision.js';
import type { ApprovedOrderIntent } from '../domain/order-intent.js';
import { validateOrderIntent } from '../domain/order-intent.js';
import type { RiskEngine } from './risk-engine.js';
import { evaluateTokenGatebook } from '../services/token-gatebook.js';
import { evaluateLaunchIntelligence } from '../services/launch-intelligence.js';
import { evaluateExitSafety } from '../services/exit-safety.js';

export type ExecutionVerdict =
  | {
      verdict: 'EXECUTABLE';
      intentId: string;
      decisionId: string;
      policyVersion: string;
      notionalUsd: number;
    }
  | {
      verdict: 'BLOCKED';
      reason: string;
      decisionId?: string;
    };

export interface ExecutionGateInput {
  intent: ApprovedOrderIntent;
  decision: RiskDecision;
  riskManager: Pick<RiskEngine, 'isTradeAllowed'>;
  killSwitch: Pick<RiskEngine, 'checkKillSwitchStatus'>;
}

export function compileExecutionVerdict(input: ExecutionGateInput): ExecutionVerdict {
  if (!isExecutableDecision(input.decision)) {
    return {
      verdict: 'BLOCKED',
      decisionId: input.decision.decisionId,
      reason: `Decision ${input.decision.decisionId} is not executable (not ALLOW or expired).`,
    };
  }

  if (input.intent.riskDecisionId !== input.decision.decisionId) {
    return {
      verdict: 'BLOCKED',
      decisionId: input.decision.decisionId,
      reason: `Intent references risk decision ${input.intent.riskDecisionId}, expected ${input.decision.decisionId}.`,
    };
  }

  const validation = validateOrderIntent(input.intent);
  if (!validation.ok) {
    return {
      verdict: 'BLOCKED',
      decisionId: input.decision.decisionId,
      reason: `intent validation failed: ${validation.errors.join('; ')}`,
    };
  }

  if (input.killSwitch.checkKillSwitchStatus()) {
    return {
      verdict: 'BLOCKED',
      decisionId: input.decision.decisionId,
      reason: 'kill switch is active.',
    };
  }

  if (input.intent.tokenGatebook) {
    const gatebook = evaluateTokenGatebook(input.intent.tokenGatebook);
    if (gatebook.verdict !== 'ALLOW') {
      return {
        verdict: 'BLOCKED',
        decisionId: input.decision.decisionId,
        reason: `token gatebook ${gatebook.verdict}: ${gatebook.reasons.join('; ')}`,
      };
    }
  }

  if (input.intent.side === 'BUY' && input.intent.launchIntelligence) {
    const launch = evaluateLaunchIntelligence(input.intent.launchIntelligence);
    if (launch.verdict === 'RISK' || launch.verdict === 'STALLED' || launch.verdict === 'UNKNOWN') {
      return {
        verdict: 'BLOCKED',
        decisionId: input.decision.decisionId,
        reason: `launch intelligence ${launch.verdict}: ${launch.reasons.join('; ')}`,
      };
    }
  }

  if (input.intent.side === 'SELL' && input.intent.exitSafety) {
    const exit = evaluateExitSafety(input.intent.exitSafety);
    if (exit.verdict === 'BLOCK') {
      return {
        verdict: 'BLOCKED',
        decisionId: input.decision.decisionId,
        reason: `exit safety BLOCK: ${exit.reasons.join('; ')}`,
      };
    }
  }

  const riskGate = input.riskManager.isTradeAllowed(input.intent.notionalUsd);
  if (!riskGate.allowed) {
    return {
      verdict: 'BLOCKED',
      decisionId: input.decision.decisionId,
      reason: riskGate.reason ?? 'Risk manager rejected the trade.',
    };
  }

  return {
    verdict: 'EXECUTABLE',
    intentId: input.intent.intentId,
    decisionId: input.decision.decisionId,
    policyVersion: input.decision.policyVersion,
    notionalUsd: input.intent.notionalUsd,
  };
}
