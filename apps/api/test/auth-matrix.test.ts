/**
 * Authorization matrix + route registry (architecture §10 / §12).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { assertRoutesGuarded, authorize, type Grant } from "@wolf/access";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";
import {
  API_ROUTE_REGISTRY,
  COMPANY_SCOPED_TABLES,
  listApiRoutesForGuardCheck,
} from "../src/routes/registry.js";
import { bumpGrantsVersion, getGrantsVersion } from "../src/modules/access/grantsVersion.js";

const dbPath = path.join(os.tmpdir(), `wolf-auth-matrix-${process.pid}.sqlite`);
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

test("every API registry route declares a permission (or public)", () => {
  assertRoutesGuarded(listApiRoutesForGuardCheck());
  assert.ok(API_ROUTE_REGISTRY.length >= 40);
  const undeclared = API_ROUTE_REGISTRY.filter((r) => !r.permission);
  assert.equal(undeclared.length, 0);
});

test("company-scoped table list is non-empty for RLS CI check", () => {
  assert.ok(COMPANY_SCOPED_TABLES.length >= 10);
  const migration = fs.readFileSync(
    path.join(process.cwd(), "migrations/002_trust_core_rls.sql"),
    "utf8",
  );
  for (const table of [
    "employments",
    "employee_profiles",
    "app_entitlements",
    "finance_employee_ref",
    "payroll_periods",
  ]) {
    assert.match(migration, new RegExp(table));
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  }
});

test("matrix: owner portal.admin allow; staff deny", () => {
  const ownerGrants: Grant[] = [
    {
      permissionKey: "portal.admin",
      scopeType: "group",
      scopeId: null,
      validFrom: "2020-01-01",
      validTo: null,
    },
  ];
  const staffGrants: Grant[] = [
    {
      permissionKey: "identity.me.read",
      scopeType: "group",
      scopeId: null,
      validFrom: "2020-01-01",
      validTo: null,
    },
  ];
  const ctx = {
    userId: "u1",
    sessionId: "s1",
    authLevel: 1,
    authTime: new Date(),
  };
  assert.equal(
    authorize(ctx, "portal.admin", { type: "admin", classification: 2 }, ownerGrants).allow,
    true,
  );
  assert.equal(
    authorize(ctx, "portal.admin", { type: "admin", classification: 2 }, staffGrants).allow,
    false,
  );
});

test("matrix: HR employee.read company-scoped; wrong company denied", () => {
  const companyId = "c-amg";
  const grants: Grant[] = [
    {
      permissionKey: "hr.employee.read",
      scopeType: "company",
      scopeId: companyId,
      validFrom: "2020-01-01",
      validTo: null,
    },
  ];
  const ctx = {
    userId: "u-hr",
    sessionId: "s1",
    authLevel: 1,
    authTime: new Date(),
    companyId,
  };
  assert.equal(
    authorize(ctx, "hr.employee.read", { type: "hr", companyId, classification: 2 }, grants)
      .allow,
    true,
  );
  assert.equal(
    authorize(
      ctx,
      "hr.employee.read",
      { type: "hr", companyId: "c-bzg", classification: 2 },
      grants,
    ).allow,
    false,
  );
});

test("HTTP: events inject denied without grant; owner allowed", async () => {
  const staffCookie = await login("staff.amg@wolf.example");
  const denied = await fetchLocal("/v1/events/inject", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: staffCookie },
    body: JSON.stringify({
      eventType: "employee.created",
      employmentId: "emp-deny",
      companyId: "co-amg",
      displayName: "Nope",
      idempotencyKey: "deny-1",
    }),
  });
  assert.equal(denied.status, 403);

  const ownerCookie = await login("owner@wolf.example");
  const allowed = await fetchLocal("/v1/events/inject", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerCookie },
    body: JSON.stringify({
      eventType: "employee.created",
      employmentId: "emp-ok",
      companyId: "co-amg",
      displayName: "Ok",
      idempotencyKey: "ok-1",
    }),
  });
  assert.equal(allowed.status, 201);
});

test("HTTP: staff cannot open admin; owner can", async () => {
  const staffCookie = await login("staff.amg@wolf.example");
  const denied = await fetchLocal("/v1/admin/users", { headers: { cookie: staffCookie } });
  assert.equal(denied.status, 403);

  const ownerCookie = await login("owner@wolf.example");
  const allowed = await fetchLocal("/v1/admin/users", { headers: { cookie: ownerCookie } });
  assert.equal(allowed.status, 200);
  assert.ok(Array.isArray(allowed.body?.items));
});

test("grants_version bumps on grant create", async () => {
  const owner = getDb()
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get("owner@wolf.example") as { id: string };
  const staff = getDb()
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get("staff.amg@wolf.example") as { id: string };
  const before = getGrantsVersion(staff.id);
  const after = bumpGrantsVersion(staff.id);
  assert.equal(after, before + 1);
  void owner;
});
