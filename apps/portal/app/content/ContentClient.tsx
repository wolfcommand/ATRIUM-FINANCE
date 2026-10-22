"use client";

import { useEffect, useState } from "react";
import { WolfButton, WolfShell } from "@wolf/ui";

type Campaign = { id: string; name: string; status: string };
type Piece = {
  id: string;
  title: string;
  channel: string;
  status: string;
  campaign_id: string | null;
};

export function ContentClient({
  companyId,
  companyCode,
}: {
  companyId: string;
  companyCode: string;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [name, setName] = useState("Q4 social push");
  const [title, setTitle] = useState("Fake launch teaser");
  const [message, setMessage] = useState("");

  async function load() {
    const headers = { "x-wolf-company-id": companyId };
    const [cRes, pRes] = await Promise.all([
      fetch(`/v1/content/campaigns?companyId=${encodeURIComponent(companyId)}`, {
        credentials: "include",
        headers,
      }),
      fetch(`/v1/content/pieces?companyId=${encodeURIComponent(companyId)}`, {
        credentials: "include",
        headers,
      }),
    ]);
    if (cRes.ok) setCampaigns((await cRes.json()).campaigns ?? []);
    if (pRes.ok) setPieces((await pRes.json()).pieces ?? []);
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  async function createCampaign() {
    const res = await fetch("/v1/content/campaigns", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-wolf-company-id": companyId },
      body: JSON.stringify({ name }),
    });
    setMessage(res.ok ? "Campaign created" : `Failed ${res.status}`);
    await load();
  }

  async function createPiece() {
    const res = await fetch("/v1/content/pieces", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-wolf-company-id": companyId },
      body: JSON.stringify({
        title,
        channel: "social",
        bodyMd: "# Fake draft\n\nGGV Content Machine sample.",
        campaignId: campaigns[0]?.id ?? null,
      }),
    });
    setMessage(res.ok ? "Piece created" : `Failed ${res.status}`);
    await load();
  }

  async function publish(id: string) {
    const res = await fetch(`/v1/content/pieces/${id}/status`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-wolf-company-id": companyId },
      body: JSON.stringify({ status: "published" }),
    });
    setMessage(res.ok ? "Published" : `Failed ${res.status}`);
    await load();
  }

  return (
    <WolfShell
      nav={
        <>
          <a href="/" style={{ fontWeight: 600 }}>
            Launcher
          </a>
          <a href="/logout" style={{ opacity: 0.85 }}>
            Sign out
          </a>
        </>
      }
    >
      <p style={{ letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>
        Content Machine · {companyCode}
      </p>
      <h1 style={{ fontFamily: '"Fraunces", serif', marginTop: 6 }}>Campaigns & pieces</h1>
      <p style={{ opacity: 0.85, maxWidth: 520 }}>
        GGV-scoped module under the same authorize() and audit model. Other companies are denied.
      </p>
      {message ? <p style={{ color: "#86efac" }}>{message}</p> : null}

      <div style={{ display: "grid", gap: 8, maxWidth: 420, marginTop: 24 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <WolfButton onClick={createCampaign}>New campaign</WolfButton>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <WolfButton variant="ghost" onClick={createPiece}>
          New piece
        </WolfButton>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: "1.1rem" }}>Campaigns ({campaigns.length})</h2>
        <ul>
          {campaigns.map((c) => (
            <li key={c.id}>
              {c.name} · {c.status}
            </li>
          ))}
        </ul>
      </section>
      <section style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: "1.1rem" }}>Pieces</h2>
        {pieces.map((p) => (
          <div key={p.id} style={cardStyle}>
            <div style={{ fontWeight: 600 }}>
              {p.title} · {p.channel} · {p.status}
            </div>
            {p.status !== "published" ? (
              <WolfButton style={{ marginTop: 8 }} onClick={() => publish(p.id)}>
                Publish
              </WolfButton>
            ) : null}
          </div>
        ))}
      </section>
    </WolfShell>
  );
}

const inputStyle = {
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid rgba(244,247,251,0.25)",
  background: "rgba(7,16,24,0.55)",
  color: "#f4f7fb",
} as const;

const cardStyle = {
  padding: "0.9rem 1rem",
  borderRadius: 10,
  background: "rgba(244,247,251,0.06)",
  border: "1px solid rgba(244,247,251,0.12)",
} as const;
