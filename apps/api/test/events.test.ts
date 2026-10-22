import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp, resetEventConsumersForTests } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase } from "../src/db/seed.js";
import { enqueueOutbox, listDeadLetters } from "../src/modules/events/outbox.js";
import { relayOnce } from "../src/modules/events/relay.js";
import {
  applyEmployeeEvent,
  ensureFinanceEmployeeRefTable,
  listEmployeeRefs,
} from "../src/modules/events/financeEmployeeRef.js";
import { clearBusForTests } from "../src/modules/events/bus.js";

const dbPath = path.join(os.tmpdir(), `wolf-events-test-${process.pid}.sqlite`);

before(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  resetEventConsumersForTests();
  clearBusForTests();
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  ensureFinanceEmployeeRefTable();
  createApp();
});

after(() => {
  try {
    fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
});

test("employee.created appears in finance.employee_ref after relay", async () => {
  const db = getDb();
  const evt = enqueueOutbox(db, {
    aggregate: "employment",
    type: "employee.created",
    payload: {
      employment_id: "emp-fake-1",
      company_id: "company-amg-fake",
      display_name: "Fake Employee One",
      cost_centre: "F&B",
      status: "active",
    },
  });
  const result = await relayOnce();
  assert.equal(result.published, 1);
  assert.equal(result.deadLettered, 0);

  const refs = listEmployeeRefs(db, "company-amg-fake");
  assert.ok(refs.some((r) => r.employment_id === "emp-fake-1"));
  assert.equal(refs.find((r) => r.employment_id === "emp-fake-1")!.display_name, "Fake Employee One");

  // Idempotent replay of same outbox id
  applyEmployeeEvent(db, {
    outboxId: evt.id,
    type: "employee.created",
    payload: evt.payload,
    version: 1,
  });
  const again = listEmployeeRefs(db, "company-amg-fake").filter((r) => r.employment_id === "emp-fake-1");
  assert.equal(again.length, 1);
});

test("duplicate employee.created events upsert without duplicate rows", async () => {
  const db = getDb();
  enqueueOutbox(db, {
    aggregate: "employment",
    type: "employee.created",
    payload: {
      employment_id: "emp-fake-2",
      company_id: "company-bzg-fake",
      display_name: "Dup Name",
      cost_centre: null,
      status: "active",
    },
  });
  enqueueOutbox(db, {
    aggregate: "employment",
    type: "employee.updated",
    payload: {
      employment_id: "emp-fake-2",
      company_id: "company-bzg-fake",
      display_name: "Dup Name Updated",
      cost_centre: "Rooms",
      status: "active",
    },
  });
  await relayOnce();
  const refs = listEmployeeRefs(db).filter((r) => r.employment_id === "emp-fake-2");
  assert.equal(refs.length, 1);
  assert.equal(refs[0]!.display_name, "Dup Name Updated");
  assert.equal(refs[0]!.cost_centre, "Rooms");
});

test("poison event lands in dead-letter table", async () => {
  const db = getDb();
  const before = listDeadLetters(db).length;
  enqueueOutbox(db, {
    aggregate: "employment",
    type: "employee.created",
    payload: { display_name: "Missing IDs" },
  });
  const result = await relayOnce();
  assert.equal(result.deadLettered, 1);
  const letters = listDeadLetters(db);
  assert.ok(letters.length > before);
  assert.ok(letters.some((l) => l.error.includes("employee_event_missing_ids")));
});
