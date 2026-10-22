import type { Db } from "../../db/client.js";
import type { SessionRow } from "./sessions.js";

export type MeResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    status: string;
  };
  session: {
    id: string;
    authLevel: number;
    authTime: string;
  };
  companies: Array<{
    id: string;
    code: string;
    name: string;
    apps: string[];
  }>;
  /** UI capabilities derived from grants (hiding UI is not security). */
  capabilities: {
    portalAdmin: boolean;
  };
  /** Catalog of company apps for launcher (entitled vs locked). */
  appCatalog: Array<{ key: string; label: string; status: "available" | "coming_soon" }>;
};

export function buildMe(db: Db, session: SessionRow): MeResponse | null {
  const user = db
    .prepare(`SELECT id, email, display_name, status FROM users WHERE id = ?`)
    .get(session.user_id) as
    | { id: string; email: string; display_name: string; status: string }
    | undefined;
  if (!user || user.status !== "active") return null;

  const employments = db
    .prepare(
      `SELECT e.company_id, c.code, c.name
       FROM employments e
       JOIN companies c ON c.id = e.company_id
       WHERE e.user_id = ? AND e.status = 'active'`,
    )
    .all(user.id) as Array<{ company_id: string; code: string; name: string }>;

  const entitlements = db
    .prepare(`SELECT company_id, app_key FROM app_entitlements WHERE user_id = ?`)
    .all(user.id) as Array<{ company_id: string; app_key: string }>;

  const companies = employments.map((e) => ({
    id: e.company_id,
    code: e.code,
    name: e.name,
    apps: entitlements
      .filter((ent) => ent.company_id === e.company_id)
      .map((ent) => ent.app_key),
  }));

  const portalAdmin = Boolean(
    db
      .prepare(
        `SELECT 1 AS ok FROM grants
         WHERE user_id = ? AND permission_key = 'portal.admin'
           AND (valid_to IS NULL OR valid_to > datetime('now'))`,
      )
      .get(user.id),
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      status: user.status,
    },
    session: {
      id: session.id,
      authLevel: session.auth_level,
      authTime: session.auth_time,
    },
    companies,
    capabilities: { portalAdmin },
    appCatalog: [
      { key: "finance", label: "Finance", status: "available" },
      { key: "hr", label: "HR", status: "available" },
      { key: "academy", label: "Academy", status: "available" },
      { key: "content", label: "Content Machine", status: "coming_soon" },
    ],
  };
}
