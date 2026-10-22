"use client";

import { useMemo, useState } from "react";
import { WolfAppTile, WolfButton, WolfShell } from "@wolf/ui";

type Company = { id: string; code: string; name: string; apps: string[] };
type CatalogItem = { key: string; label: string; status: "available" | "coming_soon" };

type Me = {
  user: { email: string; displayName: string };
  companies: Company[];
  capabilities: { portalAdmin: boolean };
  appCatalog: CatalogItem[];
};

export function LauncherClient({ me }: { me: Me }) {
  const [companyId, setCompanyId] = useState(me.companies[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const company = useMemo(
    () => me.companies.find((c) => c.id === companyId) ?? me.companies[0],
    [companyId, me.companies],
  );

  async function requestAccess(appKey: "finance" | "hr") {
    if (!company) return;
    if (appKey !== "finance" && appKey !== "hr") return;
    setPendingKey(appKey);
    setMessage("");
    try {
      const res = await fetch("/v1/access/requests", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          permissionKey: appKey === "finance" ? "app.finance" : "app.hr",
          reason: `Request ${appKey} add-on for ${company.code}`,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setMessage(`Access request submitted for ${appKey.toUpperCase()} (${company.code}).`);
      } else {
        setMessage(body.error ?? `Request failed (${res.status})`);
      }
    } catch {
      setMessage("API unreachable.");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <WolfShell
      nav={
        <>
          {me.capabilities.portalAdmin ? (
            <a href="/admin" style={{ fontWeight: 600 }}>
              Admin
            </a>
          ) : null}
          <a href="/logout" style={{ opacity: 0.85 }}>
            Sign out
          </a>
        </>
      }
      footer="Wolf Intelligence — fake data only in this environment."
    >
      <p
        style={{
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.7,
          margin: 0,
          fontSize: "0.8rem",
        }}
      >
        Group launcher
      </p>
      <h1
        style={{
          fontFamily: '"Fraunces", serif',
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          margin: "0.4rem 0 0.75rem",
          letterSpacing: "-0.03em",
        }}
      >
        Wolf Intelligence
      </h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.9, maxWidth: 520, lineHeight: 1.5 }}>
        Signed in as <strong>{me.user.displayName}</strong> ({me.user.email}). Choose a company,
        then open an entitled app — or request access for a locked add-on.
      </p>

      {me.companies.length > 1 ? (
        <label style={{ display: "grid", gap: 6, marginTop: "1.75rem", maxWidth: 320 }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Company</span>
          <select
            value={company?.id ?? ""}
            onChange={(e) => setCompanyId(e.target.value)}
            style={{
              padding: "0.65rem 0.75rem",
              borderRadius: 8,
              border: "1px solid rgba(244,247,251,0.25)",
              background: "rgba(7,16,24,0.55)",
              color: "#f4f7fb",
              fontSize: "1rem",
            }}
          >
            {me.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : company ? (
        <p style={{ marginTop: "1.5rem", opacity: 0.85 }}>
          Company: <strong>{company.code}</strong> — {company.name}
        </p>
      ) : (
        <p style={{ marginTop: "1.5rem" }}>No company memberships.</p>
      )}

      {message ? (
        <p style={{ color: "#86efac", marginTop: "1rem" }} role="status">
          {message}
        </p>
      ) : null}

      <div style={{ display: "grid", gap: "0.85rem", marginTop: "1.75rem" }}>
        {(me.appCatalog ?? []).map((item) => {
          if (!company) return null;
          if (item.status === "coming_soon") {
            return (
              <WolfAppTile
                key={item.key}
                title={item.label}
                subtitle={`${company.code} · not in this phase`}
                state="soon"
              />
            );
          }
          const entitled = company.apps.includes(item.key);
          if (entitled) {
            const href =
              item.key === "finance"
                ? `/open-finance?companyId=${encodeURIComponent(company.id)}`
                : item.key === "hr"
                  ? `/open-hr?companyId=${encodeURIComponent(company.id)}`
                  : `/academy?companyId=${encodeURIComponent(company.id)}`;
            return (
              <WolfAppTile
                key={item.key}
                title={item.label}
                subtitle={`${company.code} · entitled`}
                state="open"
                action={
                  <span style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <a href={href} style={{ fontWeight: 700, textDecoration: "underline" }}>
                      Open {item.label}
                    </a>
                    {item.key === "finance" ? (
                      <a
                        href={`/approvals?companyId=${encodeURIComponent(company.id)}`}
                        style={{ fontWeight: 600, textDecoration: "underline", opacity: 0.9 }}
                      >
                        Approvals
                      </a>
                    ) : null}
                  </span>
                }
              />
            );
          }
          return (
            <WolfAppTile
              key={item.key}
              title={item.label}
              subtitle={`${company.code} · add-on required`}
              state="locked"
              action={
                <WolfButton
                  variant="ghost"
                  disabled={pendingKey === item.key}
                  onClick={() => requestAccess(item.key as "finance" | "hr")}
                >
                  {pendingKey === item.key ? "Requesting…" : "Request access"}
                </WolfButton>
              }
            />
          );
        })}
      </div>
    </WolfShell>
  );
}
