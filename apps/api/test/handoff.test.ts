import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { resetKeysForTests, getSigningKeys } from "../src/lib/keys.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";

const dbPath = path.join(os.tmpdir(), `wolf-handoff-test-${process.pid}.sqlite`);
let app: ReturnType<typeof createApp>;
let baseUrl = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;

before(async () => {
  process.env.WOLF_KEY_DIR = path.join(os.tmpdir(), `wolf-keys-${process.pid}`);
  resetKeysForTests();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  app = createApp();
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  try {
    fs.unlinkSync(dbPath);
  } catch {
    /* ignore */
  }
  resetKeysForTests();
});

async function loginCookie(email: string): Promise<{ cookie: string; me: any }> {
  const res = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  assert.equal(res.status, 200);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const hit = setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(hit);
  const body = await res.json();
  return { cookie: hit!.split(";")[0]!, me: body.me };
}

test("issues handoff token verifiable via JWKS with audience finance", async () => {
  const { cookie, me } = await loginCookie("finance.amg@wolf.example");
  const companyId = me.companies.find((c: { code: string }) => c.code === "AMG").id;
  const tokenRes = await fetch(`${baseUrl}/v1/handoff/token`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audience: "finance", companyId }),
  });
  assert.equal(tokenRes.status, 200);
  const { token } = (await tokenRes.json()) as { token: string };
  const jwks = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer: "wolf-api", audience: "finance" });
  assert.equal(payload.session_id, me.session.id);
  assert.equal(payload.company_id, companyId);
  assert.ok(payload.user_id);
  assert.ok(payload.auth_time);
  assert.equal(typeof payload.auth_level, "number");
});

test("rejects wrong audience verification", async () => {
  const { cookie, me } = await loginCookie("finance.amg@wolf.example");
  const companyId = me.companies.find((c: { code: string }) => c.code === "AMG").id;
  const tokenRes = await fetch(`${baseUrl}/v1/handoff/token`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audience: "finance", companyId }),
  });
  const { token } = (await tokenRes.json()) as { token: string };
  const jwks = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`));
  await assert.rejects(() =>
    jwtVerify(token, jwks, { issuer: "wolf-api", audience: "hr" }),
  );
});

test("rejects tampered token", async () => {
  const { cookie, me } = await loginCookie("finance.amg@wolf.example");
  const companyId = me.companies.find((c: { code: string }) => c.code === "AMG").id;
  const tokenRes = await fetch(`${baseUrl}/v1/handoff/token`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audience: "finance", companyId }),
  });
  const { token } = (await tokenRes.json()) as { token: string };
  const parts = token.split(".");
  const tampered = `${parts[0]}.${parts[1]}.AAAA`;
  const jwks = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`));
  await assert.rejects(() =>
    jwtVerify(tampered, jwks, { issuer: "wolf-api", audience: "finance" }),
  );
});

test("expired token fails verification", async () => {
  const keys = await getSigningKeys();
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    user_id: "u",
    session_id: "s",
    company_id: "c",
    auth_level: 1,
    auth_time: new Date().toISOString(),
  })
    .setProtectedHeader({ alg: "EdDSA", kid: keys.kid })
    .setIssuer("wolf-api")
    .setAudience("finance")
    .setIssuedAt(now - 120)
    .setExpirationTime(now - 60)
    .sign(keys.privateKey);
  const jwks = createRemoteJWKSet(new URL(`${baseUrl}/.well-known/jwks.json`));
  await assert.rejects(() =>
    jwtVerify(token, jwks, { issuer: "wolf-api", audience: "finance" }),
  );
});

test("revoked wolf session is not active", async () => {
  const { cookie, me } = await loginCookie("finance.bzg@wolf.example");
  const sessionId = me.session.id as string;
  await fetch(`${baseUrl}/v1/auth/sessions/${sessionId}/revoke`, {
    method: "POST",
    headers: { cookie },
  });
  const active = await fetch(`${baseUrl}/v1/sessions/${sessionId}/active`);
  const body = await active.json();
  assert.equal(body.active, false);
});
