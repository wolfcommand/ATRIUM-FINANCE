export type PermissionKey = string;

export type AuthContext = {
  userId: string;
  sessionId: string;
  authLevel: number;
  authTime: Date;
  companyId?: string;
};

export type ResourceRef = {
  type: string;
  id?: string;
  companyId?: string;
  ownerUserId?: string;
  classification?: 0 | 1 | 2 | 3;
  attrs?: Record<string, unknown>;
};

export type Obligation =
  | "mask:field"
  | "require_step_up"
  | "log_read"
  | "limit:rows";

export type Decision = {
  allow: boolean;
  reason: string;
  obligations: Obligation[];
};

export type Grant = {
  permissionKey: PermissionKey;
  scopeType: "group" | "company" | "department" | "self";
  scopeId: string | null;
  validFrom: string;
  validTo: string | null;
};
