/**
 * Reconciliation script for journal money major↔minor conversion.
 * Fake / local store only — never point at production data.
 *
 * Usage: pnpm --filter @wolf/finance exec tsx scripts/reconcile-journal-money.ts
 */
import { store } from "../server/store.js";

async function main() {
  await store.init().catch(() => undefined);
  store.backfillJournalScoping();
  const before = store.reconcileJournalMoney();
  // Idempotent re-backfill simulates "after" migration pass
  store.backfillJournalScoping();
  const after = store.reconcileJournalMoney();

  const report = {
    before_count: before.before_count,
    after_count: after.after_count,
    before_debit_minor_total: before.before_debit_minor_total,
    after_debit_minor_total: after.after_debit_minor_total,
    totals_match: before.before_debit_minor_total === after.after_debit_minor_total,
    ok: before.ok && after.ok,
    sample_errors: after.journals.filter((j) => !j.ok).slice(0, 5),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok || !report.totals_match) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
