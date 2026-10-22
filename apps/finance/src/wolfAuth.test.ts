import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../../api/src/app.js";
import { resetDbForTests, setDb } from "../../api/src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../../api/src/db/seed.js";
import { resetKeysForTests } from "../../api/src/lib/keys.js";
import {
  clearFinanceSessions,
  exchangeHandoffToken,
  resetJwksForTests,
} from "../server/wolfAuth.js";

/**
 * Cross-package test: verifies Finance handoff against a live Wolf API.
 * Path imports reach into apps/api (monorepo) — fine for CI.
 */

const dbPath = path.join(os.tmpdir(), `wolf-fin-handoff-${process.pid}.sqlite`);
let apiServer: ReturnType<ReturnType<typeof createApp>["listen"]>;
let apiBase = "";

before(async () => {
  process.env.WOLF_KEY_DIR = path.join(os.tmpdir(), `wolf-fin-keys-${process.pid}`);
  resetKeysForTests();
  clearFinanceSessions();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  const app = createApp();
  apiServer = app.listen(0);
  await new Promise<void>((r) => apiServer.once("listening", () => r()));
  const addr = apiServer.address();
  assert.ok(addr && typeof addr === "object");
  apiBase = `http://127.0.0.1:${addr.port}`;
  process.env.WOLF_API_ORIGIN = apiBase;
  process.env.WOLF_JWKS_URL = `${apiBase}/.well-known/jwks.json`;
  resetJwksForTests();
});

after(async () => {
  await new Promise<void>((r) => apiServer.close(() => r()));
  resetKeysForTests();
  clearFinanceSessions();
});

async function mintToken(): Promise<string> {
  const login = await fetch(`${apiBase}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "finance.amg@wolf.example", password: SEED_PASSWORD }),
  });
  const setCookie = login.headers.getSetCookie?.() ?? [];
  const cookie = setCookie[0]!.split(";")[0]!;
  const me = await login.json();
  const companyId = me.me.companies.find((c: { code: string }) => c.code === "AMG").id;
  const tokenRes = await fetch(`${apiBase}/v1/handoff/token`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audience: "finance", companyId }),
  });
  const body = await tokenRes.json();
  return body.token as string;
}

test("finance accepts valid handoff token", async () => {
  const token = await mintToken();
  const session = await exchangeHandoffToken(token);
  assert.ok(session.userId);
  assert.ok(session.companyId);
  assert.ok(session.wolfSessionId);
});

test("finance rejects wrong audience token material via verification failure path", async () => {
  const token = await mintToken();
  const bad = token.slice(0, -4) + "dead";
  await assert.rejects(() => exchangeHandoffToken(bad));
});
