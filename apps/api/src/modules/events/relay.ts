import { getDb } from "../../db/client.js";
import { listUnpublished, markPublished, recordDeadLetter } from "./outbox.js";
import { publish } from "./bus.js";

/**
 * Polls the outbox and publishes to the in-memory bus.
 * Marks published after successful handler fan-out; DLQ on handler failure.
 */
export async function relayOnce(limit = 50): Promise<{ published: number; deadLettered: number }> {
  const db = getDb();
  const pending = listUnpublished(db, limit);
  let published = 0;
  let deadLettered = 0;

  for (const evt of pending) {
    try {
      await publish({
        outboxId: evt.id,
        type: evt.type,
        payload: evt.payload,
        version: evt.version,
      });
      markPublished(db, evt.id);
      published += 1;
    } catch (err) {
      recordDeadLetter(db, {
        outboxId: evt.id,
        type: evt.type,
        payload: evt.payload,
        error: err instanceof Error ? err.message : String(err),
      });
      // Still mark published so we do not retry infinitely; recovery is via DLQ replay later
      markPublished(db, evt.id);
      deadLettered += 1;
    }
  }

  return { published, deadLettered };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startRelay(intervalMs = 500): void {
  if (timer) return;
  timer = setInterval(() => {
    void relayOnce().catch(() => {
      /* swallow; next tick retries remaining */
    });
  }, intervalMs);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

export function stopRelay(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
