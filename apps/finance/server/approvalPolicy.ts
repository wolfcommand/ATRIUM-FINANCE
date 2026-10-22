/**
 * Configurable approval policy (architecture §9.5).
 * Default mirrors legacy Finance journal flow: single approver step.
 */

export type ApprovalStep = {
  stepNo: number;
  approverRule: "role:approver" | "direct_manager" | "owner";
  condition?: { minAmountMinor?: number };
};

export type ApprovalPolicy = {
  id: string;
  companyId: string | null;
  requestType: string;
  version: number;
  validFrom: string;
  validTo: string | null;
  steps: ApprovalStep[];
};

const policies: ApprovalPolicy[] = [
  {
    id: "pol-journal-default",
    companyId: null,
    requestType: "finance.journal",
    version: 1,
    validFrom: "2020-01-01",
    validTo: null,
    steps: [{ stepNo: 1, approverRule: "role:approver" }],
  },
];

export type ApprovalSnapshot = {
  policyId: string;
  policyVersion: number;
  steps: ApprovalStep[];
  snapshotAt: string;
};

export function resolvePolicy(
  companyId: string,
  requestType: string,
  amountMinor?: number,
): ApprovalSnapshot {
  const policy =
    policies.find(
      (p) =>
        p.requestType === requestType &&
        (p.companyId === companyId || p.companyId === null) &&
        !p.validTo,
    ) ?? policies[0]!;

  const steps = policy.steps.filter((s) => {
    if (s.condition?.minAmountMinor != null && amountMinor != null) {
      return amountMinor >= s.condition.minAmountMinor;
    }
    return true;
  });

  return {
    policyId: policy.id,
    policyVersion: policy.version,
    steps: steps.length ? steps : policy.steps,
    snapshotAt: new Date().toISOString(),
  };
}

export function listPolicies(): ApprovalPolicy[] {
  return policies;
}
