/**
 * Transactional outbox + in-memory / emulator relay (Prompt 7).
 * HR publishers deferred — tests enqueue synthetic events.
 */
import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";

export type OutboxEventRow = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_version: number;
  payload: string;
  created_at: string;
  published_at: string | null;
  idempotency_key: string;
};

export type WolfEvent = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
};

export type EventHandler = (event: WolfEvent) => Promise<void> | void;

const handlers = new Map<string, Set<EventHandler>>();

export function resetOutboxHandlersForTests(): void {
  handlers.clear();
}

export function subscribe(eventType: string, handler: EventHandler): () => void {
  let set = handlers.get(eventType);
  if (!set) {
    set = new Set();
    handlers.set(eventType, set);
  }
  set.add(handler);
  return () => set!.delete(handler);
}

export function enqueueOutboxEvent(
  input: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    version?: number;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  },
  db: Db = getDb(),
): OutboxEventRow {
  const existing = db
    .prepare(`SELECT * FROM outbox_events WHERE idempotency_key = ?`)
    .get(input.idempotencyKey) as OutboxEventRow | undefined;
  if (existing) return existing;

  const row: OutboxEventRow = {
    id: newId(),
    aggregate_type: input.aggregateType,
    aggregate_id: input.aggregateId,
    event_type: input.eventType,
    event_version: input.version ?? 1,
    payload: JSON.stringify(input.payload),
    created_at: new Date().toISOString(),
    published_at: null,
    idempotency_key: input.idempotencyKey,
  };
  db.prepare(
    `INSERT INTO outbox_events
      (id, aggregate_type, aggregate_id, event_type, event_version, payload, created_at, published_at, idempotency_key)
     VALUES (@id, @aggregate_type, @aggregate_id, @event_type, @event_version, @payload, @created_at, @published_at, @idempotency_key)`,
  ).run(row);
  return row;
}

function toWolfEvent(row: OutboxEventRow): WolfEvent {
  return {
    id: row.id,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    type: row.event_type,
    version: row.event_version,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

export function listUnpublished(db: Db = getDb(), limit = 100): OutboxEventRow[] {
  return db
    .prepare(
      `SELECT * FROM outbox_events WHERE published_at IS NULL ORDER BY created_at ASC LIMIT ?`,
    )
    .all(limit) as OutboxEventRow[];
}

/**
 * Relay unpublished outbox rows to in-process subscribers (dev emulator).
 * Marks published_at even if a consumer fails — failures go to DLQ via consumer wrapper.
 */
export async function relayOnce(db: Db = getDb()): Promise<{ published: number }> {
  const rows = listUnpublished(db);
  let published = 0;
  for (const row of rows) {
    const event = toWolfEvent(row);
    const set = handlers.get(event.type) ?? new Set();
    // Also deliver to wildcard "*" handlers
    const wild = handlers.get("*") ?? new Set();
    const all = [...set, ...wild];
    for (const handler of all) {
      await handler(event);
    }
    db.prepare(`UPDATE outbox_events SET published_at = ? WHERE id = ?`).run(
      new Date().toISOString(),
      row.id,
    );
    published += 1;
  }
  return { published };
}

export function startRelayLoop(opts?: {
  intervalMs?: number;
  db?: Db;
}): { stop: () => void } {
  const intervalMs = opts?.intervalMs ?? 200;
  const db = opts?.db ?? getDb();
  const timer = setInterval(() => {
    void relayOnce(db).catch(() => undefined);
  }, intervalMs);
  timer.unref?.();
  return {
    stop: () => clearInterval(timer),
  };
}
