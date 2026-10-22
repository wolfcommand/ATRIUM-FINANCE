const FINANCE_DEV_URL =
  process.env.NEXT_PUBLIC_FINANCE_URL ?? "http://localhost:3000";

export default function PortalLauncherPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "4rem 1.5rem",
      }}
    >
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75 }}>
        Placeholder launcher
      </p>
      <h1 style={{ fontSize: "2.5rem", margin: "0.5rem 0 1rem" }}>Wolf Intelligence</h1>
      <p style={{ fontSize: "1.125rem", lineHeight: 1.6, opacity: 0.9, maxWidth: 540 }}>
        Open the company apps you are entitled to. Identity and shared authorization land in
        later prompts — this page is a shell only.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "2rem" }}>
        <a
          href={FINANCE_DEV_URL}
          style={{
            display: "block",
            padding: "1rem 1.25rem",
            background: "#f8fafc",
            color: "#0f172a",
            textDecoration: "none",
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          Finance — open local app ({FINANCE_DEV_URL})
        </a>
        <span
          style={{
            display: "block",
            padding: "1rem 1.25rem",
            background: "rgba(248,250,252,0.12)",
            borderRadius: 8,
            opacity: 0.85,
          }}
        >
          HR — coming soon (apps/hr deferred until the HR source is ready)
        </span>
      </div>
    </main>
  );
}
