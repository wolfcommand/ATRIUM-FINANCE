import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp, resetEventConsumersForTests } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";
import { clearMailForTests, listSentMail } from "../src/modules/admin/mailer.js";
import { EMPLOYEE_CSV_HEADER } from "../src/modules/admin/employeeImport.js";

const dbPath = path.join(os.tmpdir(), `wolf-admin-test-${process.pid}.sqlite`);
let app: ReturnType<typeof createApp>;

before(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  resetEventConsumersForTests();
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  clearMailForTests();
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
    const body = await res.json().catch(() => ({}));
    return { status: res.status, headers, body };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

async function loginAsOwner() {
  const res = await fetchLocal("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner@wolf.example", password: SEED_PASSWORD }),
  });
  assert.equal(res.status, 200);
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const hit = list.find((c) => String(c).startsWith(`${SESSION_COOKIE}=`));
  assert.ok(hit);
  return String(hit).split(";")[0]!;
}

test("bad CSV preview is rejected with clear errors", async () => {
  const cookie = await loginAsOwner();
  const csv = `${EMPLOYEE_CSV_HEADER}
Bad Person,not-an-email,ZZZ,Ops,Clerk,,01/15/2026,full-time,
Dup One,dup@wolf.example,AMG,Ops,Clerk,,2026-01-15,full-time,
Dup Two,dup@wolf.example,AMG,Ops,Clerk,,2026-01-15,full-time,
Orphan,orphan@wolf.example,AMG,Ops,Clerk,missing.mgr@wolf.example,2026-01-15,full-time,
`;
  const res = await fetchLocal("/v1/admin/employees/import/preview", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ csv }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, false);
  const messages = (res.body.errors as Array<{ message: string }>).map((e) => e.message).join(" | ");
  assert.match(messages, /valid work email|unknown company|start date|duplicate email|unknown manager/i);

  const commit = await fetchLocal("/v1/admin/employees/import", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ csv }),
  });
  assert.equal(commit.status, 400);
});

test("clean CSV imports, grants base perms, stubs activation mail, audits", async () => {
  const cookie = await loginAsOwner();
  clearMailForTests();
  const csv = `${EMPLOYEE_CSV_HEADER}
Fake New Hire,newhire@wolf.example,AMG,Front Office,Associate,,2026-03-01,full-time,
`;
  const preview = await fetchLocal("/v1/admin/employees/import/preview", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ csv }),
  });
  assert.equal(preview.body.ok, true);

  const commit = await fetchLocal("/v1/admin/employees/import", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ csv }),
  });
  assert.equal(commit.status, 201);
  assert.equal(commit.body.imported, 1);

  const user = getDb()
    .prepare(`SELECT id, email FROM users WHERE email = ?`)
    .get("newhire@wolf.example") as { id: string; email: string };
  assert.ok(user);

  const grants = getDb()
    .prepare(`SELECT permission_key FROM grants WHERE user_id = ?`)
    .all(user.id) as Array<{ permission_key: string }>;
  assert.ok(grants.some((g) => g.permission_key === "finance.health.read"));

  const mail = listSentMail();
  assert.ok(mail.some((m) => m.to === "newhire@wolf.example" && /Activate/i.test(m.subject)));

  const audit = await fetchLocal("/v1/admin/audit", {
    headers: { cookie },
  });
  assert.equal(audit.status, 200);
  const actions = (audit.body.items as Array<{ action: string }>).map((a) => a.action);
  assert.ok(actions.includes("admin.employee.import"));
});

test("admin can list users and create a grant with audit", async () => {
  const cookie = await loginAsOwner();
  const users = await fetchLocal("/v1/admin/users", { headers: { cookie } });
  assert.equal(users.status, 200);
  assert.ok((users.body.items as unknown[]).length >= 6);

  const staff = getDb()
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get("staff.amg@wolf.example") as { id: string };
  const company = getDb()
    .prepare(`SELECT id FROM companies WHERE code = ?`)
    .get("AMG") as { id: string };

  const grant = await fetchLocal("/v1/admin/grants", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      userId: staff.id,
      permissionKey: "finance.report.read",
      scopeType: "company",
      scopeId: company.id,
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      reason: "temporary report access for fake pilot",
    }),
  });
  assert.equal(grant.status, 201);

  const audit = await fetchLocal("/v1/admin/audit", { headers: { cookie } });
  const actions = (audit.body.items as Array<{ action: string }>).map((a) => a.action);
  assert.ok(actions.includes("admin.grant.create"));
});
