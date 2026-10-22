import { cookies } from "next/headers";
import Link from "next/link";
import { WolfShell } from "@wolf/ui";
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
      <WolfShell>
        <h1>Admin</h1>
        <p>
          <Link href="/login">Sign in</Link> required.
        </p>
      </WolfShell>
    );
  }
  const cookieHeader = `wolf_session=${session.value}`;
  const data = await loadAdminBootstrap(cookieHeader);
  if (data.forbidden) {
    return (
      <WolfShell
        nav={
          <Link href="/" style={{ fontWeight: 600 }}>
            Launcher
          </Link>
        }
      >
        <h1>Admin</h1>
        <p>Forbidden — requires the portal.admin grant (UI hide is not security).</p>
        <Link href="/">← Launcher</Link>
      </WolfShell>
    );
  }

  return (
    <WolfShell
      nav={
        <Link href="/" style={{ fontWeight: 600 }}>
          Launcher
        </Link>
      }
    >
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>
        Wolf Intelligence
      </p>
      <h1 style={{ fontFamily: '"Fraunces", serif', marginTop: 4 }}>Portal admin</h1>
      <p style={{ opacity: 0.85 }}>
        Decide access requests, manage grants, and import employees (fake data only).
      </p>
      <AdminClient
        initialUsers={data.users}
        initialMemberships={data.memberships}
        initialGrants={data.grants}
        initialRequests={data.requests}
        initialAudit={data.audit}
      />
    </WolfShell>
  );
}
