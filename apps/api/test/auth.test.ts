import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";

const dbPath = path.join(os.tmpdir(), `wolf-auth-test-${process.pid}.sqlite`);
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

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
  const hit = list.find((c) => String(c).startsWith(`${SESSION_COOKIE}=`));
  assert.ok(hit, "expected session cookie");
  return String(hit).split(";")[0]!;
}

async function login(email: string, password = SEED_PASSWORD) {
  const res = await fetchLocal("/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res;
}

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
        const all = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [v];
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

test("login succeeds for seeded user and /v1/me returns companies and apps", async () => {
  const loginRes = await login("finance.amg@wolf.example");
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body?.ok, true);
  assert.equal(loginRes.body?.me?.user?.email, "finance.amg@wolf.example");
  assert.ok(loginRes.body?.me?.companies?.some((c: { code: string }) => c.code === "AMG"));
  assert.ok(
    loginRes.body?.me?.companies?.find((c: { code: string }) => c.code === "AMG")?.apps?.includes(
      "finance",
    ),
  );

  const cookie = cookieFrom(loginRes);
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal(me.body?.user?.email, "finance.amg@wolf.example");
  assert.ok(me.body?.session?.id);
  assert.ok(me.body?.session?.authTime);
});

test("logout clears session", async () => {
  const loginRes = await login("staff.amg@wolf.example");
  const cookie = cookieFrom(loginRes);
  const out = await fetchLocal("/v1/auth/logout", {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(out.status, 200);
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  assert.equal(me.status, 401);
});

test("revoked session cannot call /v1/me", async () => {
  const loginRes = await login("finance.bzg@wolf.example");
  const cookie = cookieFrom(loginRes);
  const sessionId = loginRes.body?.me?.session?.id as string;
  assert.ok(sessionId);
  const revoked = await fetchLocal(`/v1/auth/sessions/${sessionId}/revoke`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body?.ok, true);
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  assert.equal(me.status, 401);
});

test("bad password is rejected", async () => {
  const res = await login("owner@wolf.example", "wrong-password");
  assert.equal(res.status, 401);
});
