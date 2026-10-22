import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";
import {
  enqueueOutboxEvent,
  relayOnce,
  resetOutboxHandlersForTests,
} from "../src/modules/integration/outbox.js";
import {
  failNextEmployeeRefConsume,
  listDeadLetters,
  listEmployeeRefs,
  registerFinanceEmployeeRefConsumer,
  resetEmployeeRefConsumerForTests,
} from "../src/modules/finance/employeeRefConsumer.js";

const dbPath = path.join(os.tmpdir(), `wolf-events-${process.pid}.sqlite`);
let unsub: (() => void) | null = null;

beforeEach(() => {
  resetOutboxHandlersForTests();
  resetEmployeeRefConsumerForTests();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  unsub = registerFinanceEmployeeRefConsumer();
});

afterEach(() => {
  unsub?.();
  unsub = null;
});

test("employee.created appears in finance.employee_ref after relay", async () => {
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-1",
    eventType: "employee.created",
    idempotencyKey: "create-emp-1",
    payload: {
      employment_id: "emp-1",
      company_id: "co-amg",
      display_name: "Fake Employee One",
      cost_centre: "100",
    },
  });
  const { published } = await relayOnce(getDb());
  assert.equal(published, 1);
  const refs = listEmployeeRefs(getDb());
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.employment_id, "emp-1");
  assert.equal(refs[0]!.status, "active");
  assert.equal(refs[0]!.cost_centre, "100");
});

test("replay with same idempotency key does not duplicate refs", async () => {
  const payload = {
    employment_id: "emp-2",
    company_id: "co-amg",
    display_name: "Fake Employee Two",
    cost_centre: "200",
  };
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-2",
    eventType: "employee.created",
    idempotencyKey: "create-emp-2",
    payload,
  });
  await relayOnce(getDb());

  // Second enqueue with same idempotency key is a no-op at outbox
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-2",
    eventType: "employee.created",
    idempotencyKey: "create-emp-2",
    payload,
  });
  const { published } = await relayOnce(getDb());
  assert.equal(published, 0);
  assert.equal(listEmployeeRefs(getDb()).length, 1);

  // Explicit second event id / key still idempotent at consumer if same key reused after republish simulation
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-2",
    eventType: "employee.updated",
    idempotencyKey: "create-emp-2-replay",
    payload: { ...payload, display_name: "Fake Employee Two Updated" },
  });
  await relayOnce(getDb());
  // Re-process same consumer key via duplicate updated with same idempotency
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-2",
    eventType: "employee.updated",
    idempotencyKey: "create-emp-2-replay",
    payload: { ...payload, display_name: "Should Not Apply Twice" },
  });
  await relayOnce(getDb());
  const refs = listEmployeeRefs(getDb());
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.display_name, "Fake Employee Two Updated");
});

test("failed consumer writes dead-letter row", async () => {
  failNextEmployeeRefConsume();
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-3",
    eventType: "employee.created",
    idempotencyKey: "create-emp-3-fail",
    payload: {
      employment_id: "emp-3",
      company_id: "co-bzg",
      display_name: "Fake Fail",
      cost_centre: null,
    },
  });
  await relayOnce(getDb());
  const dlq = listDeadLetters(getDb());
  assert.equal(dlq.length, 1);
  assert.match(dlq[0]!.error_message, /forced_consumer_failure/);
  assert.equal(listEmployeeRefs(getDb()).length, 0);
});

test("employment.ended marks finance ref ended", async () => {
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-4",
    eventType: "employee.created",
    idempotencyKey: "create-emp-4",
    payload: {
      employment_id: "emp-4",
      company_id: "co-ggv",
      display_name: "Fake End",
      cost_centre: "300",
    },
  });
  await relayOnce(getDb());
  enqueueOutboxEvent({
    aggregateType: "employment",
    aggregateId: "emp-4",
    eventType: "employment.ended",
    idempotencyKey: "end-emp-4",
    payload: {
      employment_id: "emp-4",
      company_id: "co-ggv",
      display_name: "Fake End",
      cost_centre: "300",
    },
  });
  await relayOnce(getDb());
  assert.equal(listEmployeeRefs(getDb())[0]!.status, "ended");
});

test("HTTP inject + relay endpoints (fake data, authorize required)", async () => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const base = `http://127.0.0.1:${addr.port}`;

  const login = await fetch(`${base}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@wolf.example", password: SEED_PASSWORD }),
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.getSetCookie?.() ?? [];
  const cookie =
    setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0] ??
    String(login.headers.get("set-cookie") ?? "")
      .split(",")
      .map((s) => s.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.split(";")[0];
  assert.ok(cookie, "owner session cookie");

  const inject = await fetch(`${base}/v1/events/inject`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      eventType: "employee.created",
      employmentId: "emp-http",
      companyId: "co-amg",
      displayName: "HTTP Fake",
      costCentre: "110",
      idempotencyKey: "http-emp-1",
    }),
  });
  assert.equal(inject.status, 201);
  const relay = await fetch(`${base}/v1/events/relay`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(relay.status, 200);
  const refs = await fetch(`${base}/v1/finance/employee-refs`, { headers: { cookie } });
  const body = (await refs.json()) as { refs: Array<{ employment_id: string }> };
  assert.ok(body.refs.some((r) => r.employment_id === "emp-http"));

  await new Promise<void>((r) => server.close(() => r()));
});
