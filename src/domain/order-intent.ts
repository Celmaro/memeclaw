import type { ChainId } from './event-envelope.js';
import type { TokenGatebookInput } from './token-gatebook.js';
import type { LaunchIntelligenceInput } from './launch-intelligence.js';
import type { ExitSafetyInput } from './exit-safety.js';

export type OrderSide = 'BUY' | 'SELL';
export type OrderVenue = string;

export interface ApprovedOrderIntent {
  schemaVersion: number;
  intentId: string;
  traceId: string;
  chain: ChainId;
  venue: OrderVenue;
  tokenAddress: string;
  side: OrderSide;
  notionalUsd: number;
  minOut: number;
  slippageBps: number;
  expirationAt: string;
  riskDecisionId: string;
  policyVersion: string;
  idempotencyKey: string;
  tokenGatebook?: TokenGatebookInput;
  launchIntelligence?: LaunchIntelligenceInput;
  exitSafety?: ExitSafetyInput;
}

export type ValidateOrderIntentResult =
  | { ok: true; errors: string[] }
  | { ok: false; errors: string[] };

const SUPPORTED_CHAINS: readonly ChainId[] = ['sol', 'robinhood', 'base', 'bsc', 'eth', 'ink'];

export function validateOrderIntent(intent: ApprovedOrderIntent): ValidateOrderIntentResult {
  const errors: string[] = [];
  if (intent.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!intent.intentId.trim()) errors.push('intentId is required');
  if (!intent.traceId.trim()) errors.push('traceId is required');
  if (!SUPPORTED_CHAINS.includes(intent.chain)) errors.push(`chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);
  if (!intent.venue.trim()) errors.push('venue is required');
  if (!intent.tokenAddress.trim()) errors.push('tokenAddress is required');
  if (intent.side !== 'BUY' && intent.side !== 'SELL') errors.push('side must be BUY or SELL');
  if (!Number.isFinite(intent.notionalUsd) || intent.notionalUsd <= 0) errors.push('notionalUsd must be a positive number');
  if (!Number.isFinite(intent.minOut) || intent.minOut < 0) errors.push('minOut must be a non-negative number');
  if (!Number.isFinite(intent.slippageBps) || intent.slippageBps < 0 || intent.slippageBps > 10000) {
    errors.push('slippageBps must be between 0 and 10000');
  }
  if (Number.isNaN(Date.parse(intent.expirationAt)) || Date.parse(intent.expirationAt) <= Date.now()) {
    errors.push('expirationAt must be a future ISO timestamp');
  }
  if (!intent.riskDecisionId.trim()) errors.push('riskDecisionId is required');
  if (!intent.policyVersion.trim()) errors.push('policyVersion is required');
  if (!intent.idempotencyKey.trim()) errors.push('idempotencyKey is required');
  return errors.length === 0 ? { ok: true, errors } : { ok: false, errors };
}
