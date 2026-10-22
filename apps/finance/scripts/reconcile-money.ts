/**
 * Fake-data money reconciliation (Prompt 5).
 * Compares float amounts vs integer minor units. Safe to run anytime; never touches real data.
 *
 * Usage: pnpm exec tsx scripts/reconcile-money.ts
 */
import { reconcileAmounts, toMinor, fromMinor } from "../server/money.js";

const FAKE_ROWS = [
  { amount: 100000 },
  { amount: 2500.5 },
  { amount: 0 },
  { amount: 99.99 },
  { amount: 1_234_567.89 },
];

function main() {
  const result = reconcileAmounts(FAKE_ROWS, "IDR");
  console.log(JSON.stringify({ ...result, sample: FAKE_ROWS.map((r) => ({
    float: r.amount,
    minor: toMinor(r.amount).amountMinor,
    roundTrip: fromMinor(toMinor(r.amount)),
  })) }, null, 2));
  if (!result.ok) {
    console.error("RECONCILE_FAILED");
    process.exit(1);
  }
  console.log("RECONCILE_OK");
}

main();
