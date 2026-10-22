import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp } from "../src/app.js";
import { resetDbForTests, setDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";

const dbPath = path.join(os.tmpdir(), `wolf-content-${process.pid}.sqlite`);
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

test("GGV content user can create campaign and piece; AMG denied", async () => {
  const cookie = await login("content.ggv@wolf.example");
  const me = await fetchLocal("/v1/me", { headers: { cookie } });
  const ggv = me.body.companies.find((c: { code: string }) => c.code === "GGV");
  assert.ok(ggv.apps.includes("content"));

  const camp = await fetchLocal("/v1/content/campaigns", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-wolf-company-id": ggv.id,
    },
    body: JSON.stringify({ name: "Fake GGV Campaign" }),
  });
  assert.equal(camp.status, 201);

  const piece = await fetchLocal("/v1/content/pieces", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-wolf-company-id": ggv.id,
    },
    body: JSON.stringify({
      title: "Teaser",
      channel: "social",
      bodyMd: "hello",
      campaignId: camp.body.id,
    }),
  });
  assert.equal(piece.status, 201);

  const amgCookie = await login("finance.amg@wolf.example");
  const amgMe = await fetchLocal("/v1/me", { headers: { cookie: amgCookie } });
  const amg = amgMe.body.companies.find((c: { code: string }) => c.code === "AMG");
  const denied = await fetchLocal("/v1/content/campaigns", {
    headers: { cookie: amgCookie, "x-wolf-company-id": amg.id },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, "content_ggv_only");
});
