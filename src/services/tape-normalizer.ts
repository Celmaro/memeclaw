import { createEventEnvelope, type EventEnvelope, type ChainId } from '../domain/event-envelope.js';

export type TapeChain = 'robinhood' | 'base' | 'bsc' | 'eth' | 'sol';

export interface TapePayload {
  symbol?: string;
  amountUsd: number;
  side: 'buy' | 'sell' | 'unknown';
  maker?: string;
  tokenAddress: string | null;
  txHash?: string;
  sourceEventId?: string | null;
  chain: TapeChain;
  raw: unknown;
}

export interface NormalizedTape {
  envelope: EventEnvelope<TapePayload>;
  chain: TapeChain;
  tokenAddress: string | null;
  tokenSymbol?: string;
  side: 'buy' | 'sell' | 'unknown';
  amountUsd: number;
  wallet?: string;
  txHash?: string;
  occurredAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function normalizeAddress(value: string | null): string | null {
  return value ? value.toLowerCase() : null;
}

function chainFrom(raw: unknown): TapeChain | null {
  const record = asRecord(raw);
  const pair = asRecord(record.pair);
  const token = asRecord(pair.baseToken ?? record.token);
  const rawChain = firstString(record.chain, record.network, record.chain_id, record.chainId, pair.chain, pair.chainId, token.chain);
  if (!rawChain) return null;
  const chainKey = String(rawChain).toLowerCase();
  if (chainKey === 'fomo' || chainKey === 'rh' || chainKey === 'robinhood' || chainKey === '5318008') return 'robinhood';
  if (chainKey === 'sol' || chainKey === 'solana') return 'sol';
  if (chainKey === 'base') return 'base';
  if (chainKey === 'bsc' || chainKey === 'bnb' || chainKey === '56') return 'bsc';
  if (chainKey === 'eth' || chainKey === 'ethereum' || chainKey === '1') return 'eth';
  return null;
}

function sideFrom(raw: unknown, trade: Record<string, unknown>): 'buy' | 'sell' | 'unknown' {
  const record = asRecord(raw);
  const value = firstString(trade.side, trade.direction, trade.type, record.side, record.direction, record.type);
  const lower = (value || '').toLowerCase();
  if (lower === 'buy' || lower === 'buy_' || lower === 'long') return 'buy';
  if (lower === 'sell' || lower === 'sell_' || lower === 'short') return 'sell';
  return 'unknown';
}

function timestampFrom(raw: unknown, trade: Record<string, unknown>, data: Record<string, unknown>): Date {
  const record = asRecord(raw);
  const rawTs = firstNumber(record.timestamp, trade.timestamp, data.timestamp, data.created_at);
  if (rawTs > 0) {
    const ms = rawTs > 1_000_000_000_000 ? rawTs : rawTs * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

/**
 * Deterministic tape normalizer for Robinhood/Fomo chain push payloads and
 * EVM Solana tape scanners. The design is borrowed from fomo-robinhood-radar
 * and fomopulse-robinhood-chain-tape: normalize first, dedupe on tx/source id,
 * and never let a raw webhook shape dictate the internal contract.
 */
export function normalizeRobinhoodFomo(raw: unknown): NormalizedTape | null {
  return normalizeTape(raw, 'tape-robinhood', 'robinhood');
}

export function normalizeTape(raw: unknown, source = 'tape', forcedChain?: TapeChain): NormalizedTape | null {
  const record = asRecord(raw);
  const pair = asRecord(record.pair);
  const pairBase = asRecord(pair.baseToken);
  const token = asRecord(pairBase ?? record.token);
  const trade = asRecord(record.trade ?? record.fill ?? record.execution);
  const data = asRecord(record.data ?? record.swap);

  const tokenAddress = normalizeAddress(
    firstString(
      record.token_address,
      data.token_address,
      data.address,
      token.address,
      pairBase.address,
      record.address
    )
  );
  const txHashRaw = firstString(record.tx_hash, trade.txHash, trade.tx_hash, data.txHash, data.tx_hash, record.hash);
  const txHash = txHashRaw ? (txHashRaw.startsWith('0x') ? txHashRaw.toLowerCase() : txHashRaw) : undefined;
  const sourceEventId = firstString(
    record.event_id,
    record.signal_id,
    record.id,
    trade.eventId,
    trade.id,
    data.event_id,
    data.id
  );

  if (!tokenAddress && !txHash && !sourceEventId) return null;

  const chain = forcedChain ?? chainFrom(raw);
  if (!chain) return null;
  const tokenSymbol = firstString(record.symbol, data.symbol, token.symbol, pairBase.symbol) || '';
  const amountUsd = firstNumber(record.amount_usd, trade.amountUsd, trade.amount_usd, data.amountUsd, data.amount_usd, trade.quoteAmount);
  const maker = firstString(record.maker, record.wallet, trade.maker, trade.wallet, data.maker, data.wallet) || undefined;
  const side = sideFrom(raw, trade);
  const occurredAt = timestampFrom(raw, trade, data);

  const envelope = createEventEnvelope({
    traceId: `tape_${occurredAt.getTime()}_${txHash || sourceEventId || tokenAddress || 'unknown'}`,
    source,
    kind: 'pair',
    occurredAt,
    context: {
      chain,
      txHash,
      sourceEventId,
    },
    payload: {
      symbol: tokenSymbol,
      amountUsd,
      side,
      maker,
      tokenAddress,
      txHash,
      sourceEventId,
      chain,
      raw,
    },
  });

  return {
    envelope,
    chain,
    tokenAddress,
    tokenSymbol,
    side,
    amountUsd,
    wallet: maker,
    txHash,
    occurredAt,
  };
}
