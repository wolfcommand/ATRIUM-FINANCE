import { cookies } from "next/headers";
import Link from "next/link";
import { WolfShell } from "@wolf/ui";
import { ContentClient } from "./ContentClient";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

type Me = {
  companies: Array<{ id: string; code: string; apps: string[] }>;
};

async function loadMe(): Promise<Me | null> {
  const jar = await cookies();
  const session = jar.get("wolf_session");
  if (!session?.value) return null;
  const res = await fetch(`${API_ORIGIN}/v1/me`, {
    headers: { cookie: `wolf_session=${session.value}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const me = await loadMe();
  const params = await searchParams;
  if (!me) {
    return (
      <WolfShell>
        <h1>Content Machine</h1>
        <p>
          <Link href="/login">Sign in</Link> required.
        </p>
      </WolfShell>
    );
  }
  const company =
    me.companies.find((c) => c.id === params.companyId) ??
    me.companies.find((c) => c.code === "GGV" && c.apps.includes("content")) ??
    me.companies.find((c) => c.apps.includes("content"));
  if (!company || !company.apps.includes("content")) {
    return (
      <WolfShell>
        <h1>Content Machine</h1>
        <p>No Content entitlement (GGV add-on). Request access from the launcher.</p>
        <Link href="/">← Launcher</Link>
      </WolfShell>
    );
  }
  return <ContentClient companyId={company.id} companyCode={company.code} />;
}
