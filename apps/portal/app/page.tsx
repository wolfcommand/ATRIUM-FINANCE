import { cookies } from "next/headers";
import Link from "next/link";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

type Me = {
  user: { email: string; displayName: string };
  companies: Array<{ id: string; code: string; name: string; apps: string[] }>;
};

async function loadMe(): Promise<Me | null> {
  const jar = await cookies();
  const session = jar.get("wolf_session");
  if (!session?.value) return null;
  try {
    const res = await fetch(`${API_ORIGIN}/v1/me`, {
      headers: { cookie: `wolf_session=${session.value}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export default async function PortalLauncherPage() {
  const me = await loadMe();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75 }}>
        Portal launcher
      </p>
      <h1 style={{ fontSize: "2.5rem", margin: "0.5rem 0 1rem" }}>Wolf Intelligence</h1>

      {!me ? (
        <>
          <p style={{ fontSize: "1.125rem", lineHeight: 1.6, opacity: 0.9 }}>
            Sign in to see companies and apps you can open.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              padding: "0.85rem 1.25rem",
              background: "#f8fafc",
              color: "#0f172a",
              textDecoration: "none",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Sign in
          </Link>
        </>
      ) : (
        <>
          <p style={{ fontSize: "1.125rem", lineHeight: 1.6, opacity: 0.9 }}>
            Signed in as <strong>{me.user.displayName}</strong> ({me.user.email})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "2rem" }}>
            {me.companies.map((c) => (
              <div
                key={c.code}
                style={{
                  padding: "1rem 1.25rem",
                  background: "rgba(248,250,252,0.12)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {c.code} — {c.name}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.apps.includes("finance") ? (
                    <a
                      href={`/open-finance?companyId=${encodeURIComponent(c.id)}`}
                      style={{ color: "#f8fafc", fontWeight: 600 }}
                    >
                      Open Finance
                    </a>
                  ) : (
                    <span style={{ opacity: 0.7 }}>No Finance add-on</span>
                  )}
                  {c.apps.includes("hr") ? (
                    <a
                      href={`/open-hr?companyId=${encodeURIComponent(c.id)}`}
                      style={{ color: "#f8fafc", fontWeight: 600 }}
                    >
                      Open HR
                    </a>
                  ) : (
                    <span style={{ opacity: 0.7 }}>No HR add-on</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: "1.25rem" }}>
            <Link href="/admin" style={{ color: "#f8fafc", fontWeight: 600 }}>
              Portal admin
            </Link>
            <span style={{ opacity: 0.65 }}> — users, grants, CSV import</span>
          </p>
          <form action="/logout" method="post" style={{ marginTop: "1.5rem" }}>
            <LogoutButton />
          </form>
        </>
      )}
    </main>
  );
}

function LogoutButton() {
  return (
    <Link href="/logout" style={{ color: "#fecaca" }}>
      Sign out
    </Link>
  );
}
