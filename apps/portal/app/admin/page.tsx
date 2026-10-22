import { cookies } from "next/headers";
import Link from "next/link";
import { AdminClient } from "./AdminClient";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

async function loadAdminBootstrap(cookieHeader: string) {
  const [users, memberships, grants, requests, audit] = await Promise.all([
    fetch(`${API_ORIGIN}/v1/admin/users`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${API_ORIGIN}/v1/admin/memberships`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
    fetch(`${API_ORIGIN}/v1/admin/grants`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
    fetch(`${API_ORIGIN}/v1/admin/access-requests`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }),
    fetch(`${API_ORIGIN}/v1/admin/audit`, { headers: { cookie: cookieHeader }, cache: "no-store" }),
  ]);
  if (users.status === 401 || users.status === 403) {
    return { forbidden: true as const };
  }
  if (!users.ok) return { forbidden: true as const };
  return {
    forbidden: false as const,
    users: (await users.json()).items ?? [],
    memberships: memberships.ok ? ((await memberships.json()).items ?? []) : [],
    grants: grants.ok ? ((await grants.json()).items ?? []) : [],
    requests: requests.ok ? ((await requests.json()).items ?? []) : [],
    audit: audit.ok ? ((await audit.json()).items ?? []) : [],
  };
}

export default async function AdminPage() {
  const jar = await cookies();
  const session = jar.get("wolf_session");
  if (!session?.value) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem" }}>
        <h1>Admin</h1>
        <p>
          <Link href="/login">Sign in</Link> required.
        </p>
      </main>
    );
  }
  const cookieHeader = `wolf_session=${session.value}`;
  const data = await loadAdminBootstrap(cookieHeader);
  if (data.forbidden) {
    return (
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.25rem" }}>
        <h1>Admin</h1>
        <p>Forbidden — portal.admin (or owner) required.</p>
        <Link href="/">Back to launcher</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2.5rem 1.25rem" }}>
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}>
        Wolf Intelligence
      </p>
      <h1 style={{ marginTop: 4 }}>Portal admin</h1>
      <p style={{ opacity: 0.85 }}>
        Users, memberships, grants, access requests, and employee CSV import (fake data only).
      </p>
      <p style={{ marginTop: 8 }}>
        <Link href="/">← Launcher</Link>
      </p>
      <AdminClient
        initialUsers={data.users}
        initialMemberships={data.memberships}
        initialGrants={data.grants}
        initialRequests={data.requests}
        initialAudit={data.audit}
      />
    </main>
  );
}
