"use client";

import { useEffect, useState } from "react";
import { WolfButton, WolfShell } from "@wolf/ui";

type InboxItem = {
  id: string;
  request_type: string;
  subject_id: string;
  amount_minor: number | null;
  currency: string | null;
  status: string;
  current_step: number;
  requester_email?: string;
  requester_name?: string;
};

export function ApprovalsClient({
  companyId,
  companyCode,
}: {
  companyId: string;
  companyCode: string;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [desc, setDesc] = useState("Fake meeting lunch");
  const [amount, setAmount] = useState("15000000");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch(`/v1/approvals/inbox?companyId=${encodeURIComponent(companyId)}`, {
      credentials: "include",
      headers: { "x-wolf-company-id": companyId },
    });
    if (res.ok) {
      const body = await res.json();
      setItems(body.items ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  async function submitExpense() {
    setMessage("");
    const res = await fetch("/v1/expenses", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-wolf-company-id": companyId,
      },
      body: JSON.stringify({
        amountMinor: Number(amount),
        currency: "IDR",
        description: desc,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 201) {
      setMessage(`Expense submitted (${body.requestId})`);
      await load();
    } else {
      setMessage(body.error ?? `Failed ${res.status}`);
    }
  }

  async function decide(id: string, decision: "approved" | "denied") {
    const res = await fetch(`/v1/approvals/requests/${id}/decide`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-wolf-company-id": companyId,
      },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setMessage(`Request ${decision}`);
      await load();
    } else {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error ?? `Decide failed ${res.status}`);
    }
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
        Approvals · {companyCode}
      </p>
      <h1 style={{ fontFamily: '"Fraunces", serif', marginTop: 6 }}>Expense inbox</h1>
      <p style={{ opacity: 0.85, maxWidth: 540 }}>
        Core approval engine with in-flight policy snapshots. Editing a policy creates a new
        version — pending requests keep their original chain.
      </p>
      {message ? <p style={{ color: "#86efac" }}>{message}</p> : null}

      <section style={{ marginTop: 24, maxWidth: 480, display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Submit expense</h2>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={inputStyle}
          placeholder="Description"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={inputStyle}
          placeholder="Amount minor units"
        />
        <WolfButton onClick={submitExpense}>Submit</WolfButton>
      </section>

      <section style={{ marginTop: 32, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Pending</h2>
        {items.length === 0 ? (
          <p style={{ opacity: 0.75 }}>Inbox empty.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={cardStyle}>
              <div style={{ fontWeight: 600 }}>
                {item.request_type} · step {item.current_step}
              </div>
              <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
                {item.requester_name ?? item.requester_email} ·{" "}
                {item.amount_minor != null
                  ? `${item.currency} ${(item.amount_minor / 100).toLocaleString()}`
                  : "—"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <WolfButton onClick={() => decide(item.id, "approved")}>Approve</WolfButton>
                <WolfButton variant="danger" onClick={() => decide(item.id, "denied")}>
                  Deny
                </WolfButton>
              </div>
            </div>
          ))
        )}
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
  padding: "1rem 1.1rem",
  borderRadius: 10,
  background: "rgba(244,247,251,0.06)",
  border: "1px solid rgba(244,247,251,0.12)",
} as const;
