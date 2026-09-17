import type {
  DecisionMemoryEntry,
  DecisionMemoryStage,
  StateStore,
} from './state-store.js';
import { globalStateStore } from './state-store.js';

export interface DecisionMemorySignalInput {
  traceId: string;
  source: string;
  chain: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  signalScore?: number;
  rawPayloadJson?: string;
}

export interface DecisionMemoryDecisionInput {
  traceId: string;
  decisionId: string;
  decisionType: string;
  reason?: string;
  chain?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
}

export interface DecisionMemoryOrderInput {
  traceId: string;
  intentId: string;
  orderId: string;
  orderStatus: string;
  notionalUsd?: number;
  filledNotionalUsd?: number;
  source?: string;
  chain?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
}

export interface DecisionMemoryJournalInput {
  traceId: string;
  journalId: string;
  source?: string;
  chain?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
}

/**
 * Appends an immutable trace of signal -> decision -> order -> journal entries
 * keyed by traceId. This is a fast-path memory for operators and auditors; it
 * never signs or broadcasts trades.
 */
export class DecisionMemory {
  constructor(private readonly stateStore: StateStore) {}

  public recordSignal(input: DecisionMemorySignalInput): void {
    this.append('SIGNAL_SEEN', {
      traceId: input.traceId,
      source: input.source,
      chain: input.chain,
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      signalScore: input.signalScore,
      rawPayloadJson: input.rawPayloadJson,
    });
  }

  public recordDecision(input: DecisionMemoryDecisionInput): void {
    this.append('DECISION_MADE', {
      traceId: input.traceId,
      source: 'decision-engine',
      chain: input.chain ?? 'unknown',
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      decisionId: input.decisionId,
      decisionType: input.decisionType,
      decisionReason: input.reason,
    });
  }

  public recordOrder(input: DecisionMemoryOrderInput): void {
    this.append('ORDER_SUBMITTED', {
      traceId: input.traceId,
      source: input.source ?? 'execution-pipeline',
      chain: input.chain ?? 'unknown',
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      intentId: input.intentId,
      orderId: input.orderId,
      orderStatus: input.orderStatus,
      filledNotionalUsd: input.filledNotionalUsd,
    });
  }

  public recordOrderOutcome(
    input: DecisionMemoryOrderInput & { stage: 'ORDER_FILLED' | 'ORDER_CANCELLED' | 'ORDER_FAILED' }
  ): void {
    this.append(input.stage, {
      traceId: input.traceId,
      source: input.source ?? 'execution-pipeline',
      chain: input.chain ?? 'unknown',
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      intentId: input.intentId,
      orderId: input.orderId,
      orderStatus: input.orderStatus,
      filledNotionalUsd: input.filledNotionalUsd,
    });
  }

  public recordJournal(input: DecisionMemoryJournalInput): void {
    this.append('JOURNAL_LOGGED', {
      traceId: input.traceId,
      source: input.source ?? 'trade-journal',
      chain: input.chain ?? 'unknown',
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      journalId: input.journalId,
    });
  }

  public list(traceId?: string, limit = 100): DecisionMemoryEntry[] {
    return this.stateStore.getDecisionMemory(traceId, limit);
  }

  private append(stage: DecisionMemoryStage, input: Partial<DecisionMemoryEntry> & { traceId: string }): void {
    this.stateStore.appendDecisionMemoryEntry({
      id: `DM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      stage,
      source: input.source ?? 'system',
      chain: input.chain ?? 'unknown',
      ...input,
    });
  }
}

/**
 * Process-wide decision memory. Fast-path push events, the polling loop, the
 * execution pipeline, and the REST API all append to the same trace ledger so
 * operators can follow a signal through decision, order, and journal stages.
 */
export const globalDecisionMemory = new DecisionMemory(globalStateStore);
