/** In-memory / emulator transport for local + CI (Prompt 7). */

export type BusMessage = {
  outboxId: string;
  type: string;
  payload: Record<string, unknown>;
  version: number;
};

type Handler = (msg: BusMessage) => Promise<void> | void;

const handlers = new Map<string, Handler[]>();
const published: BusMessage[] = [];

export function subscribe(type: string, handler: Handler): void {
  const list = handlers.get(type) ?? [];
  list.push(handler);
  handlers.set(type, list);
}

export function clearBusForTests(): void {
  handlers.clear();
  published.length = 0;
}

export function listPublishedForTests(): readonly BusMessage[] {
  return published;
}

export async function publish(msg: BusMessage): Promise<void> {
  published.push(msg);
  const list = handlers.get(msg.type) ?? [];
  const wild = handlers.get("*") ?? [];
  for (const h of [...list, ...wild]) {
    await h(msg);
  }
}
