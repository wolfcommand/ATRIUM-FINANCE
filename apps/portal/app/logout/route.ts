import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.WOLF_API_ORIGIN ?? "http://127.0.0.1:4000";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const session = jar.get("wolf_session");
  if (session?.value) {
    try {
      await fetch(`${API_ORIGIN}/v1/auth/logout`, {
        method: "POST",
        headers: { cookie: `wolf_session=${session.value}` },
      });
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("wolf_session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
