"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { WolfButton, WolfShell } from "@wolf/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("finance.amg@wolf.example");
  const [password, setPassword] = useState("Wolf-Fake-Pass-1!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Login failed (fake credentials only).");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("API unreachable. Start @wolf/api on port 4000.");
    } finally {
      setPending(false);
    }
  }

  return (
    <WolfShell
      nav={
        <a href="/" style={{ opacity: 0.85 }}>
          Launcher
        </a>
      }
    >
      <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: "2rem", marginTop: 0 }}>Sign in</h1>
      <p style={{ opacity: 0.85 }}>Wolf portal — fake seeded users only.</p>
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: "0.85rem", marginTop: "1.5rem", maxWidth: 420 }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
        </label>
        {error ? <p style={{ color: "#fecaca" }}>{error}</p> : null}
        <WolfButton type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </WolfButton>
      </form>
    </WolfShell>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "0.65rem 0.75rem",
  borderRadius: 8,
  border: "1px solid rgba(244,247,251,0.25)",
  background: "rgba(7,16,24,0.55)",
  color: "#f4f7fb",
} as const;
