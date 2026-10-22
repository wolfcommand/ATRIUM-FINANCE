import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb, getDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";
import {
  getApprovalRequest,
  publishNewPolicyVersion,
} from "../src/modules/approvals/engine.js";

const dbPath = path.join(os.tmpdir(), `wolf-approvals-${process.pid}.sqlite`);
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

test("expense submit snapshots policy; policy bump does not rewrite in-flight", async () => {
  const cookie = await login("finance.amg@wolf.example");
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  const amg = me.body.companies.find((c: { code: string }) => c.code === "AMG");
  assert.ok(amg);

  const created = await fetchLocal("/v1/expenses", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-wolf-company-id": amg.id,
    },
    body: JSON.stringify({
      amountMinor: 100_000_00,
      currency: "IDR",
      description: "Fake taxi for month-end",
    }),
  });
  assert.equal(created.status, 201);
  const requestId = created.body.requestId as string;
  const snapVersion = created.body.snapshot.policy_version as number;
  assert.equal(snapVersion, 1);
  assert.ok(created.body.snapshot.steps.length >= 1);

  const owner = getDb()
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get("owner@wolf.example") as { id: string };
  publishNewPolicyVersion({
    companyId: amg.id,
    requestType: "finance.expense",
    actorUserId: owner.id,
    steps: [{ step_no: 1, approver_rule: "owner", amount_threshold_minor: null }],
  });

  const row = getApprovalRequest(requestId)!;
  const frozen = JSON.parse(String(row.chain_snapshot)) as {
    policy_version: number;
    steps: unknown[];
  };
  assert.equal(frozen.policy_version, 1);
  assert.notEqual(frozen.steps.length, 0);

  const decide = await fetchLocal(`/v1/approvals/requests/${requestId}/decide`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-wolf-company-id": amg.id,
    },
    body: JSON.stringify({ decision: "approved" }),
  });
  assert.equal(decide.status, 200);
});

test("staff without finance grant cannot submit expense", async () => {
  const cookie = await login("staff.amg@wolf.example");
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  const amg = me.body.companies.find((c: { code: string }) => c.code === "AMG");
  const denied = await fetchLocal("/v1/expenses", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-wolf-company-id": amg.id,
    },
    body: JSON.stringify({
      amountMinor: 1000,
      currency: "IDR",
      description: "Nope",
    }),
  });
  assert.equal(denied.status, 403);
});
