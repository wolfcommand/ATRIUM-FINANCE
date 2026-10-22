import type { Db } from "../../db/client.js";
import { getDb } from "../../db/client.js";
import { newId } from "../../lib/ids.js";

export type OutboxEvent = {
  id: string;
  aggregate: string;
  type: string;
  payload: Record<string, unknown>;
  version: number;
  created_at: string;
  published_at: string | null;
};

/** Enqueue an event in the same DB transaction as domain writes (callers pass tx db). */
export function enqueueOutbox(
  db: Db,
  input: {
    aggregate: string;
    type: string;
    payload: Record<string, unknown>;
    version?: number;
  },
): OutboxEvent {
  const id = newId();
  const created_at = new Date().toISOString();
  const version = input.version ?? 1;
  db.prepare(
    `INSERT INTO outbox_events (id, aggregate, type, payload, version, created_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(id, input.aggregate, input.type, JSON.stringify(input.payload), version, created_at);
  return {
    id,
    aggregate: input.aggregate,
    type: input.type,
    payload: input.payload,
    version,
    created_at,
    published_at: null,
  };
}

export function listUnpublished(db: Db = getDb(), limit = 50): OutboxEvent[] {
  const rows = db
    .prepare(
      `SELECT id, aggregate, type, payload, version, created_at, published_at
       FROM outbox_events WHERE published_at IS NULL
       ORDER BY created_at ASC LIMIT ?`,
    )
    .all(limit) as Array<{
    id: string;
    aggregate: string;
    type: string;
    payload: string;
    version: number;
    created_at: string;
    published_at: string | null;
  }>;
  return rows.map((r) => ({
    ...r,
    payload: JSON.parse(r.payload) as Record<string, unknown>,
  }));
}

export function markPublished(db: Db, id: string): void {
  db.prepare(`UPDATE outbox_events SET published_at = ? WHERE id = ?`).run(
    new Date().toISOString(),
    id,
  );
}

export function recordDeadLetter(
  db: Db,
  input: { outboxId: string; type: string; payload: Record<string, unknown>; error: string },
): void {
  db.prepare(
    `INSERT INTO dead_letter_events (id, outbox_id, type, payload, error, failed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    input.outboxId,
    input.type,
    JSON.stringify(input.payload),
    input.error,
    new Date().toISOString(),
  );
}

export function listDeadLetters(db: Db = getDb()) {
  return db
    .prepare(
      `SELECT id, outbox_id, type, payload, error, failed_at FROM dead_letter_events ORDER BY failed_at DESC`,
    )
    .all() as Array<{
    id: string;
    outbox_id: string;
    type: string;
    payload: string;
    error: string;
    failed_at: string;
  }>;
}
