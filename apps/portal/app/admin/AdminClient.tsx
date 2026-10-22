"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { WolfButton } from "@wolf/ui";

type AccessRequest = {
  id: string;
  requester_user_id: string;
  requester_email?: string;
  company_id: string;
  company_code?: string;
  permission_key: string;
  reason: string;
  status: string;
};

type Props = {
  initialUsers: unknown[];
  initialMemberships: unknown[];
  initialGrants: unknown[];
  initialRequests: AccessRequest[];
  initialAudit: unknown[];
};

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export function AdminClient(props: Props) {
  const [tab, setTab] = useState<
    "users" | "memberships" | "grants" | "requests" | "import" | "audit"
  >("requests");
  const [requests, setRequests] = useState(props.initialRequests);
  const [csv, setCsv] = useState(
    `full name,work email,company,department,job title,direct manager,start date,employment type,add-ons\n`,
  );
  const [preview, setPreview] = useState<{
    ok?: boolean;
    errors?: unknown[];
    rows?: unknown[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [grantForm, setGrantForm] = useState({
    userId: "",
    permissionKey: "finance.journal.read",
    scopeType: "company",
    scopeId: "",
    reason: "admin grant",
  });

  const pending = useMemo(
    () => requests.filter((r) => r.status === "pending"),
    [requests],
  );

  async function decide(id: string, decision: "approved" | "denied") {
    const res = await postJson(`/v1/admin/access-requests/${id}/decide`, { decision });
    if (res.status === 200) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: decision } : r)),
      );
      setMessage(`Request ${decision}`);
    } else {
      setMessage(res.json.error ?? `Decide failed (${res.status})`);
    }
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(
          [
            ["requests", "Access requests"],
            ["users", "Users"],
            ["memberships", "Memberships"],
            ["grants", "Grants"],
            ["import", "CSV import"],
            ["audit", "Audit"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              padding: "0.5rem 0.85rem",
              borderRadius: 6,
              border: "1px solid rgba(248,250,252,0.25)",
              background: tab === id ? "#f8fafc" : "transparent",
              color: tab === id ? "#0f172a" : "#f8fafc",
              cursor: "pointer",
            }}
          >
            {label}
            {id === "requests" && pending.length ? ` (${pending.length})` : ""}
          </button>
        ))}
      </div>

      {message ? <p style={{ color: "#86efac" }}>{message}</p> : null}

      {tab === "users" && <JsonTable title="Users" rows={props.initialUsers} />}
      {tab === "memberships" && (
        <JsonTable title="Memberships" rows={props.initialMemberships} />
      )}
      {tab === "grants" && (
        <section>
          <h2>Create grant</h2>
          <div style={{ display: "grid", gap: 8, maxWidth: 520, marginBottom: 16 }}>
            <input
              placeholder="user id"
              value={grantForm.userId}
              onChange={(e) => setGrantForm({ ...grantForm, userId: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="permission key"
              value={grantForm.permissionKey}
              onChange={(e) => setGrantForm({ ...grantForm, permissionKey: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="scope id (company id)"
              value={grantForm.scopeId}
              onChange={(e) => setGrantForm({ ...grantForm, scopeId: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="reason"
              value={grantForm.reason}
              onChange={(e) => setGrantForm({ ...grantForm, reason: e.target.value })}
              style={inputStyle}
            />
            <WolfButton
              onClick={async () => {
                const res = await postJson("/v1/admin/grants", {
                  userId: grantForm.userId,
                  permissionKey: grantForm.permissionKey,
                  scopeType: grantForm.scopeType,
                  scopeId: grantForm.scopeId || null,
                  validFrom: new Date().toISOString().slice(0, 10),
                  reason: grantForm.reason,
                });
                setMessage(
                  res.status === 201
                    ? `Grant created ${res.json.id}`
                    : res.json.error ?? `Failed ${res.status}`,
                );
              }}
            >
              Create grant
            </WolfButton>
          </div>
          <JsonTable title="Grants" rows={props.initialGrants} />
        </section>
      )}

      {tab === "requests" && (
        <section>
          <h2>Access requests</h2>
          {requests.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No requests yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {requests.map((r) => (
                <div key={r.id} style={cardStyle}>
                  <div style={{ fontWeight: 600 }}>
                    {r.permission_key} · {r.company_code ?? r.company_id} · {r.status}
                  </div>
                  <div style={{ opacity: 0.85, fontSize: 14, marginTop: 4 }}>
                    {r.requester_email ?? r.requester_user_id}: {r.reason}
                  </div>
                  {r.status === "pending" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <WolfButton onClick={() => decide(r.id, "approved")}>Approve</WolfButton>
                      <WolfButton variant="danger" onClick={() => decide(r.id, "denied")}>
                        Deny
                      </WolfButton>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "audit" && <JsonTable title="Audit" rows={props.initialAudit} />}

      {tab === "import" && (
        <section>
          <h2>Employee CSV import</h2>
          <p style={{ opacity: 0.8, fontSize: 14 }}>
            Preview validates duplicates, unknown company/manager, and bad dates. Commit is
            all-or-nothing. Activation email is stubbed.
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              padding: 12,
              borderRadius: 8,
              background: "rgba(15,23,42,0.6)",
              color: "#f8fafc",
              border: "1px solid rgba(248,250,252,0.2)",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <WolfButton
              onClick={async () => {
                const res = await postJson("/v1/admin/employees/import/preview", { csv });
                setPreview(res.json);
                setMessage(
                  res.json.ok
                    ? "Preview OK"
                    : `Preview failed (${res.json.errors?.length ?? 0} errors)`,
                );
              }}
            >
              Preview
            </WolfButton>
            <WolfButton
              variant="ghost"
              onClick={async () => {
                const res = await postJson("/v1/admin/employees/import", { csv });
                if (res.status === 201) {
                  setMessage(`Imported ${res.json.imported} employees`);
                  setPreview(null);
                } else {
                  setMessage(`Import rejected: ${res.json.error ?? res.status}`);
                }
              }}
            >
              Import
            </WolfButton>
          </div>
          {preview ? (
            <pre
              style={{
                marginTop: 16,
                padding: 12,
                overflow: "auto",
                background: "rgba(15,23,42,0.5)",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {JSON.stringify(preview, null, 2)}
            </pre>
          ) : null}
        </section>
      )}
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: "0.55rem 0.7rem",
  borderRadius: 6,
  border: "1px solid rgba(248,250,252,0.25)",
  background: "rgba(15,23,42,0.55)",
  color: "#f8fafc",
};

const cardStyle: CSSProperties = {
  padding: "1rem 1.1rem",
  borderRadius: 10,
  background: "rgba(244,247,251,0.06)",
  border: "1px solid rgba(244,247,251,0.12)",
};

function JsonTable({ title, rows }: { title: string; rows: unknown[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <pre
        style={{
          padding: 12,
          overflow: "auto",
          maxHeight: 420,
          background: "rgba(15,23,42,0.5)",
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        {JSON.stringify(rows, null, 2)}
      </pre>
    </section>
  );
}
