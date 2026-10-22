import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { AccountingStore } from "../server/store.js";
import { toMinor, fromMinor, normalizeMoneyLine, reconcileJournalLines } from "../server/money.js";
import {
  appendAuditEvent,
  listAuditEvents,
  resetAuditLogForTests,
  updateAuditEvent,
  deleteAuditEvent,
} from "../server/auditLog.js";
import {
  evaluateJournalApproval,
  resetApprovalPoliciesForTests,
} from "../server/approvalPolicy.js";

const COMPANY_A = "company-amg-test";
const COMPANY_B = "company-bzg-test";

beforeEach(() => {
  resetAuditLogForTests();
  resetApprovalPoliciesForTests();
});

test("money helpers round-trip IDR major ↔ minor", () => {
  assert.equal(toMinor(12500.5, "IDR"), 1250050);
  assert.equal(fromMinor(1250050, "IDR"), 12500.5);
  const line = normalizeMoneyLine({ debit: 100.1, credit: 0 }, "IDR");
  assert.equal(line.debit_minor, 10010);
  assert.equal(line.debit, 100.1);
});

test("reconcile script logic accepts consistent journals", () => {
  const money = normalizeMoneyLine({ debit: 500, credit: 0 }, "IDR");
  const money2 = normalizeMoneyLine({ debit: 0, credit: 500 }, "IDR");
  const report = reconcileJournalLines([
    {
      journal_id: "J1",
      currency: "IDR",
      lines: [
        { debit: money.debit, credit: money.credit, debit_minor: money.debit_minor, credit_minor: money.credit_minor },
        { debit: money2.debit, credit: money2.credit, debit_minor: money2.debit_minor, credit_minor: money2.credit_minor },
      ],
    },
  ]);
  assert.equal(report.ok, true);
  assert.equal(report.before_count, report.after_count);
  assert.equal(report.before_debit_minor_total, report.after_debit_minor_total);
});

test("company isolation: user cannot read another company's journal", async () => {
  const store = new AccountingStore();
  store.defaultCompanyId = COMPANY_A;
  store.systemSettings.period_lock_date = "";

  const a = await store.createJournal(
    {
      company_id: COMPANY_A,
      currency: "IDR",
      journal_date: "2026-10-01",
      period: "2026-10",
      source_type: "MANUAL",
      source_reference: "iso-a",
      created_by: "tester",
    },
    [
      { account_code: "1010", department_code: "100", debit: 1000, credit: 0, description: "a" },
      { account_code: "4010", department_code: "100", debit: 0, credit: 1000, description: "a" },
    ],
  );
  const b = await store.createJournal(
    {
      company_id: COMPANY_B,
      currency: "IDR",
      journal_date: "2026-10-01",
      period: "2026-10",
      source_type: "MANUAL",
      source_reference: "iso-b",
      created_by: "tester",
    },
    [
      { account_code: "1010", department_code: "100", debit: 2000, credit: 0, description: "b" },
      { account_code: "4010", department_code: "100", debit: 0, credit: 2000, description: "b" },
    ],
  );

  const listA = store.getJournals(COMPANY_A);
  assert.ok(listA.some((j) => j.journal_id === a.journal_id));
  assert.ok(!listA.some((j) => j.journal_id === b.journal_id));
  assert.equal(store.getJournalById(b.journal_id, COMPANY_A), null);
  assert.ok(store.getJournalById(b.journal_id, COMPANY_B));
});

test("createJournal stores integer minor units + currency", async () => {
  const store = new AccountingStore();
  store.systemSettings.period_lock_date = "";
  const j = await store.createJournal(
    {
      company_id: COMPANY_A,
      currency: "IDR",
      journal_date: "2026-10-02",
      period: "2026-10",
      source_type: "MANUAL",
      source_reference: "money",
      created_by: "tester",
    },
    [
      { account_code: "1010", department_code: "100", debit: 99.99, credit: 0, description: "d" },
      { account_code: "4010", department_code: "100", debit: 0, credit: 99.99, description: "c" },
    ],
  );
  assert.equal(j.currency, "IDR");
  assert.equal(j.lines[0]!.debit_minor, 9999);
  assert.equal(j.lines[1]!.credit_minor, 9999);
  assert.equal(store.reconcileJournalMoney().ok, true);
});

test("audit events on create / approve / delete; append-only", async () => {
  const store = new AccountingStore();
  store.systemSettings.period_lock_date = "";
  // Ensure chart has accounts used below (seed may already)
  if (!store.accounts.has("1010")) {
    store.accounts.set("1010", {
      account_code: "1010",
      account_name: "Cash",
      account_type: "Asset",
      normal_balance: "Debit",
      statutory_line: "",
      usali_line: "",
      active: "Y",
    } as any);
  }
  if (!store.accounts.has("4010")) {
    store.accounts.set("4010", {
      account_code: "4010",
      account_name: "Revenue",
      account_type: "Revenue",
      normal_balance: "Credit",
      statutory_line: "",
      usali_line: "",
      active: "Y",
    } as any);
  }

  const j = await store.createJournal(
    {
      company_id: COMPANY_A,
      currency: "IDR",
      journal_date: "2026-10-03",
      period: "2026-10",
      source_type: "MANUAL",
      source_reference: "aud",
      created_by: "tester",
    },
    [
      { account_code: "1010", department_code: "100", debit: 50, credit: 0, description: "d" },
      { account_code: "4010", department_code: "100", debit: 0, credit: 50, description: "c" },
    ],
  );
  appendAuditEvent({
    actor_user_id: "u1",
    session_id: "s1",
    company_id: COMPANY_A,
    action: "finance.journal.create",
    resource_type: "finance.journal",
    resource_id: j.journal_id,
    outcome: "allow",
    request_id: null,
    changes: { status: "DRAFT" },
  });

  await store.validateJournal(j.journal_id);
  const approved = await store.approveJournal(j.journal_id, "Controller", { companyId: COMPANY_A });
  appendAuditEvent({
    actor_user_id: "u1",
    session_id: "s1",
    company_id: COMPANY_A,
    action: "finance.journal.approve",
    resource_type: "finance.journal",
    resource_id: approved.journal_id,
    outcome: "allow",
    request_id: null,
    changes: { policy: approved.approval_policy_snapshot },
  });
  assert.ok(approved.approval_policy_snapshot);

  // Can't delete approved — create another draft to delete
  const draft = await store.createJournal(
    {
      company_id: COMPANY_A,
      currency: "IDR",
      journal_date: "2026-10-03",
      period: "2026-10",
      source_type: "MANUAL",
      source_reference: "del",
      created_by: "tester",
    },
    [
      { account_code: "1010", department_code: "100", debit: 10, credit: 0, description: "d" },
      { account_code: "4010", department_code: "100", debit: 0, credit: 10, description: "c" },
    ],
  );
  await store.deleteDraftJournal(draft.journal_id);
  appendAuditEvent({
    actor_user_id: "u1",
    session_id: "s1",
    company_id: COMPANY_A,
    action: "finance.journal.delete",
    resource_type: "finance.journal",
    resource_id: draft.journal_id,
    outcome: "allow",
    request_id: null,
    changes: null,
  });
  appendAuditEvent({
    actor_user_id: "u1",
    session_id: "s1",
    company_id: COMPANY_A,
    action: "finance.journal.export",
    resource_type: "finance.journal",
    resource_id: null,
    outcome: "allow",
    request_id: null,
    changes: { format: "csv" },
  });

  const events = listAuditEvents({ company_id: COMPANY_A });
  assert.ok(events.some((e) => e.action === "finance.journal.create"));
  assert.ok(events.some((e) => e.action === "finance.journal.approve"));
  assert.ok(events.some((e) => e.action === "finance.journal.delete"));
  assert.ok(events.some((e) => e.action === "finance.journal.export"));
  assert.throws(() => updateAuditEvent());
  assert.throws(() => deleteAuditEvent());
});

test("default approval policy matches prior VALIDATED→APPROVED behavior", () => {
  const denied = evaluateJournalApproval({
    companyId: COMPANY_A,
    requestType: "finance.journal.approve",
    subjectStatus: "DRAFT",
  });
  assert.equal(denied.allow, false);

  const allowed = evaluateJournalApproval({
    companyId: COMPANY_A,
    requestType: "finance.journal.approve",
    subjectStatus: "VALIDATED",
    approverName: "Zayen (Controller)",
  });
  assert.equal(allowed.allow, true);
  if (allowed.allow) {
    assert.equal(allowed.snapshot.policy_id, "pol-finance-journal-approve-default");
    assert.equal(allowed.approverName, "Zayen (Controller)");
  }
});
