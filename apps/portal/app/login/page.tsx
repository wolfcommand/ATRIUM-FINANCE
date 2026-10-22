"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem" }}>Sign in</h1>
      <p style={{ opacity: 0.85 }}>Wolf portal — fake seeded users only.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
            autoComplete="current-password"
          />
        </label>
        {error ? <p style={{ color: "#fecaca" }}>{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "0.75rem 1rem",
            fontWeight: 600,
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
