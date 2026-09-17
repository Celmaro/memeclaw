export type ChainId = 'sol' | 'robinhood' | 'base' | 'bsc' | 'eth' | 'ink';
export type EventSource = string;

export interface EventContext {
  chain: ChainId;
  slot?: number | null;
  blockNumber?: number | null;
  txHash?: string | null;
  sourceEventId?: string | null;
}

export interface EventEnvelope<T = unknown> {
  schemaVersion: number;
  eventId: string;
  traceId: string;
  source: EventSource;
  kind: string;
  occurredAt: string;
  dedupeKey: string;
  context: EventContext;
  payload: T;
}

export interface CreateEventEnvelopeInput<T> {
  eventId?: string;
  traceId: string;
  source: EventSource;
  kind: string;
  occurredAt?: Date;
  context: EventContext;
  payload: T;
}

let seq = 0;

function uuidLike(): string {
  seq += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${seq}-${rand}`;
}

export function buildEventDedupeKey(input: {
  source: EventSource;
  kind: string;
  context: EventContext;
  occurredAt: string;
  payload: unknown;
}): string {
  const anchor =
    input.context.txHash ??
    input.context.sourceEventId ??
    input.context.slot ??
    input.context.blockNumber ??
    input.occurredAt;
  const payloadJson = JSON.stringify(input.payload ?? {});
  return [input.source, input.context.chain, input.kind, anchor, payloadJson].join(':');
}

export function createEventEnvelope<T>(input: CreateEventEnvelopeInput<T>): EventEnvelope<T> {
  const occurredAt = (input.occurredAt ?? new Date()).toISOString();
  return {
    schemaVersion: 1,
    eventId: input.eventId ?? uuidLike(),
    traceId: input.traceId,
    source: input.source,
    kind: input.kind,
    occurredAt,
    dedupeKey: buildEventDedupeKey({
      source: input.source,
      kind: input.kind,
      context: input.context,
      occurredAt,
      payload: input.payload,
    }),
    context: input.context,
    payload: input.payload,
  };
}

export function isEventStale(event: Pick<EventEnvelope, 'occurredAt'>, maxAgeMs: number): boolean {
  const at = Date.parse(event.occurredAt);
  if (Number.isNaN(at)) return true;
  return Date.now() - at > maxAgeMs;
}
