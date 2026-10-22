import assert from "node:assert/strict";
import test from "node:test";
import { AccountingStore } from "../server/store.js";
import { reconcileAmounts, toMinor, fromMinor } from "../server/money.js";
import { writeAudit, listAudit, clearAuditForTests } from "../server/auditLog.js";
import { resolvePolicy, listPolicies } from "../server/approvalPolicy.js";
import { filterByCompany, withCompanyId } from "../server/companyScope.js";

test("money: float → minor → float round-trips for fake amounts", () => {
  const samples = [0, 1, 99.99, 100000, 1234.56];
  for (const n of samples) {
    const m = toMinor(n, "IDR");
    assert.equal(m.currency, "IDR");
    assert.equal(fromMinor(m), Math.round(n * 100) / 100);
  }
  const recon = reconcileAmounts(
    samples.map((amount) => ({ amount })),
    "IDR",
  );
  assert.equal(recon.ok, true);
  assert.equal(recon.before.count, recon.after.count);
});

test("company isolation: AMG user cannot read BZG journal", async () => {
  const s = new AccountingStore();
  // Avoid Sheets side-effects in unit tests
  s.syncTabToSheets = async () => {};
  s.systemSettings.period_lock_date = "";

  s.currentCompanyId = "company-amg-fake";
  const amg = await s.createJournal(
    {
      journal_date: "2026-08-15",
      period: "2026-08",
      source_type: "MANUAL",
      source_reference: "iso-amg",
      created_by: "test",
    },
    [
      { account_code: "1000", department_code: "", debit: 100, credit: 0, description: "d" },
      { account_code: "2000", department_code: "", debit: 0, credit: 100, description: "c" },
    ],
  );
  assert.equal(amg.company_id, "company-amg-fake");
  assert.ok((amg.total_debit_minor ?? 0) > 0);

  s.currentCompanyId = "company-bzg-fake";
  const bzg = await s.createJournal(
    {
      journal_date: "2026-08-15",
      period: "2026-08",
      source_type: "MANUAL",
      source_reference: "iso-bzg",
      created_by: "test",
    },
    [
      { account_code: "1000", department_code: "", debit: 50, credit: 0, description: "d" },
      { account_code: "2000", department_code: "", debit: 0, credit: 50, description: "c" },
    ],
  );

  s.currentCompanyId = "company-amg-fake";
  assert.equal(s.getJournalById(bzg.journal_id), null);
  assert.ok(s.getJournalById(amg.journal_id));
  assert.ok(s.getJournals().every((j) => j.company_id === "company-amg-fake"));

  const rows = [
    withCompanyId({ id: "1" }, "a"),
    withCompanyId({ id: "2" }, "b"),
  ];
  assert.deepEqual(filterByCompany(rows, "a").map((r) => r.id), ["1"]);
});

test("audit: create/update/delete/approve/export events append", () => {
  clearAuditForTests();
  writeAudit({
    actorUserId: "u1",
    sessionId: "s1",
    companyId: "c1",
    action: "finance.journal.create",
    resourceType: "journal",
    resourceId: "J1",
    outcome: "allow",
    requestId: null,
    changes: { status: "DRAFT" },
  });
  writeAudit({
    actorUserId: "u1",
    sessionId: "s1",
    companyId: "c1",
    action: "finance.journal.approve",
    resourceType: "journal",
    resourceId: "J1",
    outcome: "allow",
    requestId: null,
    changes: null,
  });
  writeAudit({
    actorUserId: "u1",
    sessionId: "s1",
    companyId: "c1",
    action: "finance.report.export",
    resourceType: "report",
    resourceId: "tb",
    outcome: "allow",
    requestId: null,
    changes: { format: "csv" },
  });
  const actions = listAudit().map((e) => e.action);
  assert.ok(actions.includes("finance.journal.create"));
  assert.ok(actions.includes("finance.journal.approve"));
  assert.ok(actions.includes("finance.report.export"));
});

test("approval policy: default finance.journal is single role:approver step", async () => {
  const policies = listPolicies();
  assert.ok(policies.some((p) => p.requestType === "finance.journal"));
  const snap = resolvePolicy("company-amg-fake", "finance.journal", 10_000);
  assert.equal(snap.policyId, "pol-journal-default");
  assert.equal(snap.steps.length, 1);
  assert.equal(snap.steps[0]!.approverRule, "role:approver");

  const s = new AccountingStore();
  s.syncTabToSheets = async () => {};
  s.systemSettings.period_lock_date = "";
  s.currentCompanyId = "company-amg-fake";
  // Seed minimal accounts so validate passes
  s.accounts.set("1000", {
    account_code: "1000",
    account_name: "Cash",
    account_type: "Asset",
    normal_balance: "Debit",
    statutory_line: "",
    usali_line: "",
    active: "Y",
  });
  s.accounts.set("2000", {
    account_code: "2000",
    account_name: "Revenue",
    account_type: "Revenue",
    normal_balance: "Credit",
    statutory_line: "",
    usali_line: "",
    active: "Y",
  });

  const j = await s.createJournal(
    {
      journal_date: "2026-08-01",
      period: "2026-08",
      source_type: "MANUAL",
      source_reference: "pol",
      created_by: "test",
    },
    [
      { account_code: "1000", department_code: "", debit: 200, credit: 0, description: "d" },
      { account_code: "2000", department_code: "", debit: 0, credit: 200, description: "c" },
    ],
  );
  await s.validateJournal(j.journal_id);
  const approved = await s.approveJournal(j.journal_id, "Fake Approver");
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.approval_snapshot?.policyId, "pol-journal-default");
  assert.equal(approved.approval_snapshot?.policyVersion, 1);
});
