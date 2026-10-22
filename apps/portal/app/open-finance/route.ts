import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";
const FINANCE_URL = process.env.NEXT_PUBLIC_FINANCE_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.redirect(new URL("/?error=missing_company", req.url));
  }
  const jar = await cookies();
  const session = jar.get("wolf_session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const tokenRes = await fetch(`${API_ORIGIN}/v1/handoff/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `wolf_session=${session.value}`,
    },
    body: JSON.stringify({ audience: "finance", companyId }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?error=handoff_denied", req.url));
  }
  const body = (await tokenRes.json()) as { token: string };
  const dest = new URL(FINANCE_URL);
  dest.searchParams.set("wolf_token", body.token);
  return NextResponse.redirect(dest);
}
