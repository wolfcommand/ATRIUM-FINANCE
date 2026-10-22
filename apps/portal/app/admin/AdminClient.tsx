"use client";

import { useState, type CSSProperties } from "react";

type Props = {
  initialUsers: unknown[];
  initialMemberships: unknown[];
  initialGrants: unknown[];
  initialRequests: unknown[];
  initialAudit: unknown[];
};

const API = "";

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

export function AdminClient(props: Props) {
  const [tab, setTab] = useState<"users" | "memberships" | "grants" | "requests" | "import" | "audit">(
    "users",
  );
  const [csv, setCsv] = useState(
    `full name,work email,company,department,job title,direct manager,start date,employment type,add-ons\n`,
  );
  const [preview, setPreview] = useState<{ ok?: boolean; errors?: unknown[]; rows?: unknown[] } | null>(
    null,
  );
  const [message, setMessage] = useState("");

  return (
    <div style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(
          [
            ["users", "Users"],
            ["memberships", "Memberships"],
            ["grants", "Grants"],
            ["requests", "Access requests"],
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
          </button>
        ))}
      </div>

      {message ? <p style={{ color: "#86efac" }}>{message}</p> : null}

      {tab === "users" && <JsonTable title="Users" rows={props.initialUsers} />}
      {tab === "memberships" && <JsonTable title="Memberships" rows={props.initialMemberships} />}
      {tab === "grants" && <JsonTable title="Grants" rows={props.initialGrants} />}
      {tab === "requests" && <JsonTable title="Access requests" rows={props.initialRequests} />}
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
            <button
              type="button"
              onClick={async () => {
                const res = await postJson("/v1/admin/employees/import/preview", { csv });
                setPreview(res.json);
                setMessage(res.json.ok ? "Preview OK" : `Preview failed (${res.json.errors?.length ?? 0} errors)`);
              }}
              style={btnStyle}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await postJson("/v1/admin/employees/import", { csv });
                if (res.status === 201) {
                  setMessage(`Imported ${res.json.imported} employees`);
                  setPreview(null);
                } else {
                  setMessage(`Import rejected: ${res.json.error ?? res.status}`);
                }
              }}
              style={btnStyle}
            >
              Import
            </button>
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

const btnStyle: CSSProperties = {
  padding: "0.55rem 1rem",
  borderRadius: 6,
  border: "none",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
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
