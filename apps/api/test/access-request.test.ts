import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";

const dbPath = path.join(os.tmpdir(), `wolf-access-req-${process.pid}.sqlite`);
let app: ReturnType<typeof createApp>;

before(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
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
  assert.ok(hit, "expected session cookie");
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

test("staff can request finance add-on; owner approve unlocks entitlement", async () => {
  const staffCookie = await login("staff.amg@wolf.example");
  const meBefore = await fetchLocal("/v1/me", { headers: { cookie: staffCookie } });
  assert.equal(meBefore.status, 200);
  const amg = meBefore.body.companies.find((c: { code: string }) => c.code === "AMG");
  assert.ok(amg);
  assert.ok(!amg.apps.includes("finance"));

  const req = await fetchLocal("/v1/access/requests", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: staffCookie },
    body: JSON.stringify({
      companyId: amg.id,
      permissionKey: "app.finance",
      reason: "Need finance for month-end",
    }),
  });
  assert.equal(req.status, 201);
  const requestId = req.body.id as string;

  const ownerCookie = await login("owner@wolf.example");
  const decide = await fetchLocal(`/v1/admin/access-requests/${requestId}/decide`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({ decision: "approved" }),
  });
  assert.equal(decide.status, 200);

  const meAfter = await fetchLocal("/v1/me", { headers: { cookie: staffCookie } });
  const amgAfter = meAfter.body.companies.find((c: { code: string }) => c.code === "AMG");
  assert.ok(amgAfter.apps.includes("finance"));

  const entitled = getDb()
    .prepare(
      `SELECT 1 AS ok FROM app_entitlements WHERE user_id = ? AND company_id = ? AND app_key = 'finance'`,
    )
    .get(
      (getDb().prepare(`SELECT id FROM users WHERE email = ?`).get("staff.amg@wolf.example") as {
        id: string;
      }).id,
      amg.id,
    );
  assert.ok(entitled);
});

test("/v1/me exposes capabilities and appCatalog", async () => {
  const cookie = await login("owner@wolf.example");
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal(me.body.capabilities.portalAdmin, true);
  assert.ok(me.body.appCatalog.some((a: { key: string }) => a.key === "academy"));
});
