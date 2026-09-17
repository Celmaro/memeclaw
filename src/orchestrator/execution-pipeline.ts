import type { ApprovedOrderIntent } from '../domain/order-intent.js';
import type { RiskDecision } from '../domain/risk-decision.js';
import type { RiskEngine } from './risk-engine.js';
import { compileExecutionVerdict, type ExecutionVerdict } from './decision-engine.js';

export type OrderStatus =
  | 'PENDING'
  | 'SIMULATED'
  | 'FILLED'
  | 'PARTIAL_FILL'
  | 'CANCELLED'
  | 'FAILED';

export interface OrderRecord {
  orderId: string;
  intent: ApprovedOrderIntent;
  decision: RiskDecision;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  txHash?: string;
  filledNotionalUsd?: number;
}

export interface SubmitOrderInput {
  intent: ApprovedOrderIntent;
  decision: RiskDecision;
  riskManager: Pick<RiskEngine, 'isTradeAllowed'>;
  killSwitch: Pick<RiskEngine, 'checkKillSwitchStatus'>;
}

export interface SubmitOrderResult {
  ok: boolean;
  order?: OrderRecord;
  verdict?: ExecutionVerdict;
  error?: string;
}

export interface ExecutionMemoryHooks {
  recordOrder(input: {
    traceId: string;
    intentId: string;
    orderId: string;
    orderStatus: string;
    notionalUsd?: number;
    source?: string;
    chain?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
  }): void;
  recordOrderOutcome(input: {
    traceId: string;
    intentId: string;
    orderId: string;
    orderStatus: string;
    stage: 'ORDER_FILLED' | 'ORDER_CANCELLED' | 'ORDER_FAILED';
    notionalUsd?: number;
    source?: string;
    chain?: string;
    tokenAddress?: string;
    tokenSymbol?: string;
  }): void;
}

export class ExecutionPipeline {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly idempotency = new Map<string, string>();

  constructor(private readonly memory?: ExecutionMemoryHooks) {}

  public submit(input: SubmitOrderInput): SubmitOrderResult {
    const existingOrderId = this.idempotency.get(input.intent.idempotencyKey);
    if (existingOrderId) {
      return {
        ok: false,
        order: this.orders.get(existingOrderId),
        error: `Duplicate idempotency key ${input.intent.idempotencyKey}`,
      };
    }

    const verdict = compileExecutionVerdict(input);
    if (verdict.verdict !== 'EXECUTABLE') {
      const order = this.createOrder(input.intent, input.decision, 'FAILED', verdict.reason);
      this.orders.set(order.orderId, order);
      this.memory?.recordOrderOutcome({
        stage: 'ORDER_FAILED',
        traceId: input.intent.traceId,
        intentId: input.intent.intentId,
        orderId: order.orderId,
        orderStatus: 'FAILED',
        notionalUsd: input.intent.notionalUsd,
        source: 'execution-pipeline',
        chain: input.intent.chain,
        tokenAddress: input.intent.tokenAddress,
      });
      return { ok: false, order, verdict, error: verdict.reason };
    }

    const order = this.createOrder(input.intent, input.decision, 'PENDING');
    this.orders.set(order.orderId, order);
    this.idempotency.set(input.intent.idempotencyKey, order.orderId);
    this.memory?.recordOrder({
      traceId: input.intent.traceId,
      intentId: input.intent.intentId,
      orderId: order.orderId,
      orderStatus: 'PENDING',
      notionalUsd: input.intent.notionalUsd,
      source: 'execution-pipeline',
      chain: input.intent.chain,
      tokenAddress: input.intent.tokenAddress,
    });
    return { ok: true, order, verdict };
  }

  public markSimulated(orderId: string, txHash?: string): OrderRecord | undefined {
    const order = this.getOrder(orderId);
    if (!order) return undefined;
    order.status = 'SIMULATED';
    order.txHash = txHash ?? order.txHash;
    order.updatedAt = new Date().toISOString();
    this.memory?.recordOrder({
      traceId: order.intent.traceId,
      intentId: order.intent.intentId,
      orderId: order.orderId,
      orderStatus: 'SIMULATED',
      notionalUsd: order.intent.notionalUsd,
      source: 'execution-pipeline',
      chain: order.intent.chain,
      tokenAddress: order.intent.tokenAddress,
    });
    return order;
  }

  public markFilled(orderId: string, txHash: string, filledNotionalUsd: number): OrderRecord | undefined {
    const order = this.getOrder(orderId);
    if (!order) return undefined;
    order.status = 'FILLED';
    order.txHash = txHash;
    order.filledNotionalUsd = filledNotionalUsd;
    order.updatedAt = new Date().toISOString();
    this.memory?.recordOrderOutcome({
      stage: 'ORDER_FILLED',
      traceId: order.intent.traceId,
      intentId: order.intent.intentId,
      orderId: order.orderId,
      orderStatus: 'FILLED',
      notionalUsd: order.intent.notionalUsd,
      source: 'execution-pipeline',
      chain: order.intent.chain,
      tokenAddress: order.intent.tokenAddress,
    });
    return order;
  }

  public markPartialFill(orderId: string, txHash: string, filledNotionalUsd: number): OrderRecord | undefined {
    const order = this.getOrder(orderId);
    if (!order) return undefined;
    order.status = 'PARTIAL_FILL';
    order.txHash = txHash;
    order.filledNotionalUsd = filledNotionalUsd;
    order.updatedAt = new Date().toISOString();
    this.memory?.recordOrderOutcome({
      stage: 'ORDER_FILLED',
      traceId: order.intent.traceId,
      intentId: order.intent.intentId,
      orderId: order.orderId,
      orderStatus: 'PARTIAL_FILL',
      notionalUsd: order.intent.notionalUsd,
      source: 'execution-pipeline',
      chain: order.intent.chain,
      tokenAddress: order.intent.tokenAddress,
    });
    return order;
  }

  public markCancelled(orderId: string): OrderRecord | undefined {
    const order = this.getOrder(orderId);
    if (!order) return undefined;
    order.status = 'CANCELLED';
    order.updatedAt = new Date().toISOString();
    this.memory?.recordOrderOutcome({
      stage: 'ORDER_CANCELLED',
      traceId: order.intent.traceId,
      intentId: order.intent.intentId,
      orderId: order.orderId,
      orderStatus: 'CANCELLED',
      notionalUsd: order.intent.notionalUsd,
      source: 'execution-pipeline',
      chain: order.intent.chain,
      tokenAddress: order.intent.tokenAddress,
    });
    return order;
  }

  public getOrder(orderId: string): OrderRecord | undefined {
    return this.orders.get(orderId);
  }

  public listOpenOrders(): OrderRecord[] {
    return [...this.orders.values()].filter((o) => o.status === 'PENDING' || o.status === 'SIMULATED' || o.status === 'PARTIAL_FILL');
  }

  public listOrders(): OrderRecord[] {
    return [...this.orders.values()];
  }

  private createOrder(
    intent: ApprovedOrderIntent,
    decision: RiskDecision,
    status: OrderStatus,
    failureReason?: string
  ): OrderRecord {
    const now = new Date().toISOString();
    return {
      orderId: intent.intentId,
      intent,
      decision,
      status,
      createdAt: now,
      updatedAt: now,
      ...(failureReason ? { failureReason } : {}),
    };
  }
}
