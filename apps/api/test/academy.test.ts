import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp, resetEventConsumersForTests } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";
import { publishEmployeeCreated } from "../src/modules/hr/publishers.js";
import { relayOnce } from "../src/modules/integration/outbox.js";
import { newId } from "../src/lib/ids.js";

const dbPath = path.join(os.tmpdir(), `wolf-academy-${process.pid}.sqlite`);
let app: ReturnType<typeof createApp>;

before(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  resetEventConsumersForTests();
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  app = createApp();
});

after(() => {
  try {
    fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
});

async function fetchLocal(
  urlPath: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
) {
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  try {
    const res = await fetch(`http://127.0.0.1:${addr.port}${urlPath}`, init);
    const headers: Record<string, unknown> = {};
    res.headers.forEach((v, k) => {
      if (k.toLowerCase() === "set-cookie") {
        const all =
          typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [v];
        headers["set-cookie"] = all;
      } else {
        headers[k] = v;
      }
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, headers, body };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const hit = list.find((c) => String(c).startsWith(`${SESSION_COOKIE}=`));
  assert.ok(hit);
  return String(hit).split(";")[0]!;
}

async function login(email: string) {
  const res = await fetchLocal("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  assert.equal(res.status, 200);
  return cookieFrom(res);
}

test("seeded staff has academy entitlement and enrollments", async () => {
  const cookie = await login("staff.amg@wolf.example");
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  const amg = me.body.companies.find((c: { code: string }) => c.code === "AMG");
  assert.ok(amg.apps.includes("academy"));
  assert.ok(me.body.appCatalog.some((a: { key: string; status: string }) => a.key === "academy" && a.status === "available"));

  const list = await fetchLocal("/v1/academy/enrollments", {
    headers: { cookie, "x-wolf-company-id": amg.id },
  });
  assert.equal(list.status, 200);
  assert.ok(list.body.enrollments.length >= 2);
});

test("employee.created event enrolls academy courses for new employment", async () => {
  const db = getDb();
  const company = db.prepare(`SELECT id FROM companies WHERE code = 'AMG'`).get() as {
    id: string;
  };
  const userId = newId();
  const employmentId = newId();
  db.prepare(
    `INSERT INTO users (id, email, display_name, status, password_hash, grants_version, created_at)
     VALUES (?, ?, 'Academy Hire', 'active', NULL, 0, ?)`,
  ).run(userId, `academy.hire.${userId.slice(0, 8)}@wolf.example`, new Date().toISOString());
  db.prepare(
    `INSERT INTO employments (id, user_id, company_id, employee_no, status, valid_from, valid_to)
     VALUES (?, ?, ?, 'AH-1', 'active', '2026-01-01', NULL)`,
  ).run(employmentId, userId, company.id);
  db.prepare(
    `INSERT INTO app_entitlements (id, user_id, company_id, app_key) VALUES (?, ?, ?, 'academy')`,
  ).run(newId(), userId, company.id);

  publishEmployeeCreated(
    {
      employment_id: employmentId,
      company_id: company.id,
      display_name: "Academy Hire",
    },
    db,
    { relay: false },
  );
  await relayOnce(db);

  const enrollments = db
    .prepare(`SELECT COUNT(*) AS n FROM academy_enrollments WHERE employment_id = ?`)
    .get(employmentId) as { n: number };
  assert.ok(enrollments.n >= 2);
});

test("progress update completes enrollment", async () => {
  const cookie = await login("staff.amg@wolf.example");
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  const amg = me.body.companies.find((c: { code: string }) => c.code === "AMG");
  const list = await fetchLocal("/v1/academy/enrollments", {
    headers: { cookie, "x-wolf-company-id": amg.id },
  });
  const open = list.body.enrollments.find((e: { status: string }) => e.status !== "completed");
  assert.ok(open);
  const done = await fetchLocal(`/v1/academy/enrollments/${open.id}/progress`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-wolf-company-id": amg.id,
    },
    body: JSON.stringify({ percent: 100 }),
  });
  assert.equal(done.status, 200);
  assert.equal(done.body.status, "completed");
});
