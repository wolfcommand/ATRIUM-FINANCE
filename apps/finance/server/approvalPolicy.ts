/**
 * Configurable approval policy (architecture §9.5).
 * Default policy preserves current Finance journal approve behavior:
 * a single controller-style step once the journal is VALIDATED.
 */

export type ApproverRule = "finance_controller" | "direct_manager" | "owner";

export type ApprovalPolicyStep = {
  step_no: number;
  approver_rule: ApproverRule;
  condition?: { min_amount_minor?: number };
};

export type ApprovalPolicy = {
  id: string;
  company_id: string | null;
  request_type: string;
  version: number;
  valid_from: string;
  valid_to: string | null;
  steps: ApprovalPolicyStep[];
};

export type ApprovalChainSnapshot = {
  policy_id: string;
  policy_version: number;
  request_type: string;
  steps: ApprovalPolicyStep[];
  snapshotted_at: string;
};

export type EvaluateApprovalInput = {
  companyId: string;
  requestType: string;
  /** Journal must already be VALIDATED for default policy */
  subjectStatus: string;
  amountMinor?: number;
  approverName?: string;
};

export type EvaluateApprovalResult =
  | { allow: true; snapshot: ApprovalChainSnapshot; approverName: string }
  | { allow: false; reason: string; snapshot: ApprovalChainSnapshot | null };

const DEFAULT_JOURNAL_APPROVE: ApprovalPolicy = {
  id: "pol-finance-journal-approve-default",
  company_id: null,
  request_type: "finance.journal.approve",
  version: 1,
  valid_from: "2020-01-01T00:00:00.000Z",
  valid_to: null,
  steps: [{ step_no: 1, approver_rule: "finance_controller" }],
};

const policies: ApprovalPolicy[] = [DEFAULT_JOURNAL_APPROVE];

export function resetApprovalPoliciesForTests(): void {
  policies.length = 0;
  policies.push({ ...DEFAULT_JOURNAL_APPROVE, steps: [...DEFAULT_JOURNAL_APPROVE.steps] });
}

export function registerApprovalPolicy(policy: ApprovalPolicy): void {
  policies.push(policy);
}

export function resolveApprovalPolicy(
  companyId: string,
  requestType: string,
  at = new Date(),
): ApprovalPolicy {
  const atIso = at.toISOString();
  const companySpecific = policies
    .filter(
      (p) =>
        p.request_type === requestType &&
        p.company_id === companyId &&
        p.valid_from <= atIso &&
        (p.valid_to === null || p.valid_to > atIso),
    )
    .sort((a, b) => b.version - a.version)[0];
  if (companySpecific) return companySpecific;

  const global = policies
    .filter(
      (p) =>
        p.request_type === requestType &&
        p.company_id === null &&
        p.valid_from <= atIso &&
        (p.valid_to === null || p.valid_to > atIso),
    )
    .sort((a, b) => b.version - a.version)[0];
  if (global) return global;

  return DEFAULT_JOURNAL_APPROVE;
}

export function evaluateJournalApproval(input: EvaluateApprovalInput): EvaluateApprovalResult {
  const policy = resolveApprovalPolicy(input.companyId, input.requestType);
  const snapshot: ApprovalChainSnapshot = {
    policy_id: policy.id,
    policy_version: policy.version,
    request_type: policy.request_type,
    steps: policy.steps.map((s) => ({ ...s })),
    snapshotted_at: new Date().toISOString(),
  };

  if (input.subjectStatus !== "VALIDATED") {
    return {
      allow: false,
      reason: `Journal must be in VALIDATED status before Approval. Current status: ${input.subjectStatus}`,
      snapshot,
    };
  }

  // Default policy: single finance_controller step — same as pre-Prompt-5 hard-coded path.
  const approverName = input.approverName || "Zayen (Controller)";
  return { allow: true, snapshot, approverName };
}
