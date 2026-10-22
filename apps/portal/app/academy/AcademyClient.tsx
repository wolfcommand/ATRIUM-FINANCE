"use client";

import { useEffect, useState } from "react";
import { WolfButton, WolfShell } from "@wolf/ui";

type Enrollment = {
  id: string;
  course_code: string;
  course_title: string;
  status: string;
  progress_percent: number | null;
  due_at: string | null;
};

export function AcademyClient({
  companyId,
  companyCode,
}: {
  companyId: string;
  companyCode: string;
}) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setError(null);
    const res = await fetch(`/v1/academy/enrollments?companyId=${encodeURIComponent(companyId)}`, {
      credentials: "include",
      headers: { "x-wolf-company-id": companyId },
    });
    if (!res.ok) {
      setError(`Failed to load enrollments (${res.status})`);
      return;
    }
    const body = await res.json();
    setEnrollments(body.enrollments ?? []);
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  async function markComplete(id: string) {
    setMessage("");
    const res = await fetch(`/v1/academy/enrollments/${id}/progress`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-wolf-company-id": companyId,
      },
      body: JSON.stringify({ percent: 100, lastPosition: "end" }),
    });
    if (!res.ok) {
      setMessage(`Progress update failed (${res.status})`);
      return;
    }
    setMessage("Course marked complete.");
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
        Academy · {companyCode}
      </p>
      <h1 style={{ fontFamily: '"Fraunces", serif', marginTop: 6 }}>Your courses</h1>
      <p style={{ opacity: 0.85, maxWidth: 520 }}>
        Base learner access for every employment. New hires receive these via the{" "}
        <code>employee.created</code> event.
      </p>
      {error ? <p style={{ color: "#fecaca" }}>{error}</p> : null}
      {message ? <p style={{ color: "#86efac" }}>{message}</p> : null}
      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {enrollments.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No enrollments yet.</p>
        ) : (
          enrollments.map((e) => (
            <div
              key={e.id}
              style={{
                padding: "1rem 1.15rem",
                borderRadius: 10,
                background: "rgba(244,247,251,0.06)",
                border: "1px solid rgba(244,247,251,0.12)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontFamily: '"Fraunces", serif', fontWeight: 600 }}>
                  {e.course_title}
                </div>
                <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                  {e.course_code} · {e.status} · {e.progress_percent ?? 0}%
                  {e.due_at ? ` · due ${e.due_at.slice(0, 10)}` : ""}
                </div>
              </div>
              {e.status !== "completed" ? (
                <WolfButton onClick={() => markComplete(e.id)}>Mark complete</WolfButton>
              ) : (
                <span style={{ opacity: 0.75 }}>Done</span>
              )}
            </div>
          ))
        )}
      </div>
    </WolfShell>
  );
}
