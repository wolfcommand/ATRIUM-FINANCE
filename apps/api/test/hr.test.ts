import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { createApp, resetEventConsumersForTests } from "../src/app.js";
import { getDb, resetDbForTests, setDb } from "../src/db/client.js";
import { seedDatabase, SEED_PASSWORD } from "../src/db/seed.js";
import { resetKeysForTests } from "../src/lib/keys.js";
import { SESSION_COOKIE } from "../src/modules/identity/sessions.js";
import { listEmployeeRefs } from "../src/modules/finance/employeeRefConsumer.js";
import { relayOnce } from "../src/modules/integration/outbox.js";

const dbPath = path.join(os.tmpdir(), `wolf-hr-test-${process.pid}.sqlite`);
let baseUrl = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;

before(async () => {
  process.env.WOLF_KEY_DIR = path.join(os.tmpdir(), `wolf-keys-hr-${process.pid}`);
  process.env.WOLF_PAYSLIP_DIR = path.join(os.tmpdir(), `wolf-payslips-${process.pid}`);
  process.env.WOLF_MAIL_DIR = path.join(os.tmpdir(), `wolf-mail-${process.pid}`);
  resetKeysForTests();
  resetEventConsumersForTests();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  setDb(resetDbForTests(dbPath));
  seedDatabase();
  const app = createApp();
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
  resetEventConsumersForTests();
});

async function login(email: string) {
  const res = await fetch(`${baseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
  });
  const text = await res.text();
  assert.equal(res.status, 200, text);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const hit = setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(hit);
  const body = JSON.parse(text);
  return { cookie: hit!.split(";")[0]!, me: body.me as any };
}

function companyId(me: any, code: string) {
  return me.companies.find((c: { code: string }) => c.code === code).id as string;
}

async function hrFetch(
  pathName: string,
  opts: { cookie: string; companyId: string; method?: string; body?: unknown },
) {
  const res = await fetch(`${baseUrl}${pathName}`, {
    method: opts.method ?? "GET",
    headers: {
      "content-type": "application/json",
      cookie: opts.cookie,
      "x-wolf-company-id": opts.companyId,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

test("hr health + meta for entitled user", async () => {
  const { cookie, me } = await login("hr.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const health = await hrFetch("/v1/hr/health", { cookie, companyId: cid });
  assert.equal(health.status, 200);
  assert.equal(health.json.service, "wolf-hr");
  const meta = await hrFetch("/v1/hr/meta", { cookie, companyId: cid });
  assert.equal(meta.status, 200);
  assert.ok(meta.json.departments.length >= 1);
  assert.ok(meta.json.leaveTypes.length >= 1);
});

test("finance-only user cannot access HR", async () => {
  const { cookie, me } = await login("finance.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const res = await hrFetch("/v1/hr/employees", { cookie, companyId: cid });
  assert.equal(res.status, 403);
  assert.equal(res.json.error, "hr_not_entitled");
});

test("create employee masks PII in list; creates finance.employee_ref", async () => {
  const { cookie, me } = await login("hr.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const created = await hrFetch("/v1/hr/employees", {
    cookie,
    companyId: cid,
    method: "POST",
    body: {
      fullName: "Fake HR Employee",
      workEmail: `fake.hr.${Date.now()}@wolf.example`,
      nik: "3201010101010001",
      npwp: "10.0.0.1-000.000",
      bankAccountNumber: "1234567890",
      dateOfBirth: "1990-01-15",
      address: "Jakarta",
      joinDate: "2026-10-01",
      baseSalaryMinor: 10_000_000_00,
      costCentre: "HR-100",
      jobTitle: "Receptionist",
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const employmentId = created.json.employee.employment_id as string;
  assert.match(String(created.json.employee.employee_code), /^AMG2610\d{4}$/);

  const list = await hrFetch("/v1/hr/employees", { cookie, companyId: cid });
  assert.equal(list.status, 200);
  const row = list.json.employees.find((e: any) => e.employment_id === employmentId);
  assert.ok(row);
  assert.equal(row.nik, "***");
  assert.equal(row.npwp, "***");
  assert.equal(row.bank_account_number, "***");
  assert.equal(row._masked, true);

  await relayOnce(getDb());
  const refs = listEmployeeRefs(getDb());
  assert.ok(refs.some((r) => r.employment_id === employmentId && r.status === "active"));
});

test("company isolation: AMG HR cannot read BZG employees", async () => {
  const amg = await login("hr.amg@wolf.example");
  const owner = await login("owner@wolf.example");
  const bzgId = companyId(owner.me, "BZG");
  const amgId = companyId(amg.me, "AMG");

  const bzgCreate = await hrFetch("/v1/hr/employees", {
    cookie: owner.cookie,
    companyId: bzgId,
    method: "POST",
    body: {
      fullName: "BZG Only Person",
      joinDate: "2026-10-05",
      workEmail: `bzg.only.${Date.now()}@wolf.example`,
    },
  });
  assert.equal(bzgCreate.status, 201, JSON.stringify(bzgCreate.json));
  const empId = bzgCreate.json.employee.employment_id as string;

  const cross = await hrFetch(`/v1/hr/employees/${empId}`, {
    cookie: amg.cookie,
    companyId: amgId,
  });
  assert.equal(cross.status, 404);
});

test("leave request + approve updates balance", async () => {
  const { cookie, me } = await login("hr.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const created = await hrFetch("/v1/hr/employees", {
    cookie,
    companyId: cid,
    method: "POST",
    body: {
      fullName: "Leave Taker",
      joinDate: "2026-01-01",
      workEmail: `leave.${Date.now()}@wolf.example`,
    },
  });
  assert.equal(created.status, 201);
  const employmentId = created.json.employee.employment_id as string;

  const types = await hrFetch("/v1/hr/leave/types", { cookie, companyId: cid });
  const annual = types.json.leaveTypes.find((t: any) => t.code === "ANNUAL");
  assert.ok(annual);

  const balBefore = await hrFetch(`/v1/hr/leave/balances/${employmentId}?year=2026`, {
    cookie,
    companyId: cid,
  });
  // ensure balance by submitting
  const req = await hrFetch("/v1/hr/leave/requests", {
    cookie,
    companyId: cid,
    method: "POST",
    body: {
      employmentId,
      leaveTypeId: annual.id,
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      reason: "fake leave",
    },
  });
  assert.equal(req.status, 201, JSON.stringify(req.json));
  const decide = await hrFetch(`/v1/hr/leave/requests/${req.json.request.id}/decide`, {
    cookie,
    companyId: cid,
    method: "POST",
    body: { decision: "approved" },
  });
  assert.equal(decide.status, 200, JSON.stringify(decide.json));

  const bal = await hrFetch(`/v1/hr/leave/balances/${employmentId}?year=2026`, {
    cookie,
    companyId: cid,
  });
  const annualBal = bal.json.balances.find((b: any) => b.leave_type_id === annual.id);
  assert.ok(annualBal);
  assert.equal(annualBal.used, 2);
  assert.ok(balBefore); // silence unused if empty first call
});

test("payroll calculate → finalize → payslip email stub", async () => {
  const { cookie, me } = await login("hr.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const created = await hrFetch("/v1/hr/employees", {
    cookie,
    companyId: cid,
    method: "POST",
    body: {
      fullName: "Payroll Person",
      joinDate: "2026-10-01",
      workEmail: `pay.${Date.now()}@wolf.example`,
      baseSalaryMinor: 5_000_000_00,
    },
  });
  assert.equal(created.status, 201);

  const periodCode = `2026-10-${Date.now()}`;
  const period = await hrFetch("/v1/hr/payroll/periods", {
    cookie,
    companyId: cid,
    method: "POST",
    body: {
      periodCode,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      payDate: "2026-11-05",
    },
  });
  assert.equal(period.status, 201, JSON.stringify(period.json));
  const periodId = period.json.period.id as string;

  const calc = await hrFetch(`/v1/hr/payroll/periods/${periodId}/calculate`, {
    cookie,
    companyId: cid,
    method: "POST",
    body: {},
  });
  assert.equal(calc.status, 200, JSON.stringify(calc.json));
  assert.equal(calc.json.period.status, "CALCULATED");
  assert.ok(calc.json.records.length >= 1);

  for (const status of ["UNDER_REVIEW", "APPROVED", "FINALIZED"] as const) {
    const tr = await hrFetch(`/v1/hr/payroll/periods/${periodId}/transition`, {
      cookie,
      companyId: cid,
      method: "POST",
      body: { status },
    });
    assert.equal(tr.status, 200, JSON.stringify(tr.json));
  }

  const slips = await hrFetch(`/v1/hr/payroll/payslips?periodId=${periodId}`, {
    cookie,
    companyId: cid,
  });
  assert.equal(slips.status, 200);
  assert.ok(slips.json.payslips.length >= 1);
  const slipId = slips.json.payslips[0].id as string;
  const emailed = await hrFetch(`/v1/hr/payroll/payslips/${slipId}/email`, {
    cookie,
    companyId: cid,
    method: "POST",
    body: {},
  });
  assert.equal(emailed.status, 200, JSON.stringify(emailed.json));
  assert.equal(emailed.json.emailStatus, "sent");
});

test("offboarding ends employment and finance ref", async () => {
  const { cookie, me } = await login("hr.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const created = await hrFetch("/v1/hr/employees", {
    cookie,
    companyId: cid,
    method: "POST",
    body: {
      fullName: "Offboard Me",
      joinDate: "2026-10-01",
      workEmail: `off.${Date.now()}@wolf.example`,
      costCentre: "X",
    },
  });
  assert.equal(created.status, 201);
  const employmentId = created.json.employee.employment_id as string;
  await relayOnce(getDb());

  const off = await hrFetch(`/v1/hr/employees/${employmentId}/offboard`, {
    cookie,
    companyId: cid,
    method: "POST",
    body: { endDate: "2026-10-22" },
  });
  assert.equal(off.status, 200, JSON.stringify(off.json));
  await relayOnce(getDb());
  const ref = listEmployeeRefs(getDb()).find((r) => r.employment_id === employmentId);
  assert.ok(ref);
  assert.equal(ref!.status, "ended");
});

test("handoff audience hr for entitled user", async () => {
  const { cookie, me } = await login("hr.amg@wolf.example");
  const cid = companyId(me, "AMG");
  const tokenRes = await fetch(`${baseUrl}/v1/handoff/token`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ audience: "hr", companyId: cid }),
  });
  assert.equal(tokenRes.status, 200);
  const body = (await tokenRes.json()) as { token: string; audience: string };
  assert.equal(body.audience, "hr");
  assert.ok(body.token);
});

test("per-company payroll policy isolation + service charge by_level", async () => {
  const owner = await login("owner@wolf.example");
  const amgId = companyId(owner.me, "AMG");
  const bzgId = companyId(owner.me, "BZG");

  const amgPol = await hrFetch("/v1/hr/payroll/policy", {
    cookie: owner.cookie,
    companyId: amgId,
  });
  const bzgPol = await hrFetch("/v1/hr/payroll/policy", {
    cookie: owner.cookie,
    companyId: bzgId,
  });
  assert.equal(amgPol.status, 200);
  assert.equal(bzgPol.status, 200);
  assert.equal(amgPol.json.policy.service_charge_mode, "by_level");
  assert.equal(bzgPol.json.policy.service_charge_mode, "equal");
  assert.notEqual(amgPol.json.policy.pph21_flat_rate, bzgPol.json.policy.pph21_flat_rate);

  // Change AMG only
  const upd = await hrFetch("/v1/hr/payroll/policy", {
    cookie: owner.cookie,
    companyId: amgId,
    method: "PUT",
    body: { pph21_flat_rate: 0.07, service_charge_mode: "by_level" },
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.json.policy.pph21_flat_rate, 0.07);
  const bzgAfter = await hrFetch("/v1/hr/payroll/policy", {
    cookie: owner.cookie,
    companyId: bzgId,
  });
  assert.equal(bzgAfter.json.policy.pph21_flat_rate, 0.06);

  // Service charge allocation: two levels share pool by weights
  for (const [name, level] of [
    ["SC Alpha", "L1"],
    ["SC Beta", "L5"],
  ] as const) {
    const c = await hrFetch("/v1/hr/employees", {
      cookie: owner.cookie,
      companyId: amgId,
      method: "POST",
      body: {
        fullName: name,
        joinDate: "2026-10-01",
        jobLevel: level,
        baseSalaryMinor: 1_000_000_00,
        workEmail: `${name.replace(/\s/g, ".").toLowerCase()}.${Date.now()}@wolf.example`,
      },
    });
    assert.equal(c.status, 201, JSON.stringify(c.json));
  }

  const period = await hrFetch("/v1/hr/payroll/periods", {
    cookie: owner.cookie,
    companyId: amgId,
    method: "POST",
    body: {
      periodCode: `sc-${Date.now()}`,
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      payDate: "2026-11-05",
      serviceChargePoolMinor: 1_000_000,
    },
  });
  assert.equal(period.status, 201, JSON.stringify(period.json));
  const calc = await hrFetch(`/v1/hr/payroll/periods/${period.json.period.id}/calculate`, {
    cookie: owner.cookie,
    companyId: amgId,
    method: "POST",
    body: {},
  });
  assert.equal(calc.status, 200, JSON.stringify(calc.json));
  const records = calc.json.records as Array<{
    full_name: string;
    job_level: string;
    gross_pay_minor: number;
  }>;
  const alpha = records.find((r) => r.full_name === "SC Alpha");
  const beta = records.find((r) => r.full_name === "SC Beta");
  assert.ok(alpha && beta);
  // L5 weight 2.2 > L1 weight 1.0 → Beta gross > Alpha gross (same base)
  assert.ok(beta!.gross_pay_minor > alpha!.gross_pay_minor);
});

test("owner can handoff finance+hr for BZG AMG GGV", async () => {
  const { cookie, me } = await login("owner@wolf.example");
  for (const code of ["BZG", "AMG", "GGV"]) {
    const cid = companyId(me, code);
    const co = me.companies.find((c: { code: string }) => c.code === code);
    assert.ok(co.apps.includes("finance"), code);
    assert.ok(co.apps.includes("hr"), code);
    for (const audience of ["finance", "hr"]) {
      const tokenRes = await fetch(`${baseUrl}/v1/handoff/token`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ audience, companyId: cid }),
      });
      assert.equal(tokenRes.status, 200, `${code} ${audience}`);
    }
  }
});
