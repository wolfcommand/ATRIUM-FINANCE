import Link from "next/link";
import { cookies } from "next/headers";
import { WolfButton, WolfShell } from "@wolf/ui";
import { LauncherClient } from "./LauncherClient";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

type Me = {
  user: { email: string; displayName: string };
  companies: Array<{ id: string; code: string; name: string; apps: string[] }>;
  capabilities: { portalAdmin: boolean };
  appCatalog: Array<{ key: string; label: string; status: "available" | "coming_soon" }>;
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
    const body = (await res.json()) as Me;
    return {
      ...body,
      capabilities: body.capabilities ?? { portalAdmin: false },
      appCatalog: body.appCatalog ?? [
        { key: "finance", label: "Finance", status: "available" },
        { key: "hr", label: "HR", status: "available" },
      ],
    };
  } catch {
    return null;
  }
}

export default async function PortalLauncherPage() {
  const me = await loadMe();

  if (!me) {
    return (
      <WolfShell>
        <p
          style={{
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.7,
            margin: 0,
            fontSize: "0.8rem",
          }}
        >
          Group portal
        </p>
        <h1
          style={{
            fontFamily: '"Fraunces", serif',
            fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
            margin: "0.4rem 0 0.85rem",
            letterSpacing: "-0.03em",
          }}
        >
          Wolf Intelligence
        </h1>
        <p style={{ fontSize: "1.15rem", opacity: 0.9, maxWidth: 480, lineHeight: 1.55 }}>
          One launcher for company workspaces. Sign in with a seeded fake account to continue.
        </p>
        <div style={{ marginTop: "1.75rem" }}>
          <Link href="/login">
            <WolfButton>Sign in</WolfButton>
          </Link>
        </div>
      </WolfShell>
    );
  }

  return <LauncherClient me={me} />;
}
