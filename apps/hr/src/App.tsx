import { FormEvent, useCallback, useEffect, useState } from "react";

type Employee = {
  employment_id: string;
  employee_code: string;
  full_name: string;
  job_title?: string;
  job_level?: string;
  status: string;
  department_name?: string;
};

type Nav = "employees" | "leave" | "payroll" | "policy";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/hr${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(json?.error || `http_${res.status}`);
  }
  return json;
}

export default function App() {
  const [nav, setNav] = useState<Nav>("employees");
  const [session, setSession] = useState<{ companyId: string; userId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobLevel, setJobLevel] = useState("L2");
  const [baseSalaryMinor, setBaseSalaryMinor] = useState("500000000");

  const boot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("wolf_token");
      if (token) {
        await fetch("/api/wolf/handoff", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        params.delete("wolf_token");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState({}, "", next);
      }
      const s = await fetch("/api/wolf/session", { credentials: "include" });
      if (!s.ok) throw new Error("Open HR from the Wolf portal (handoff required).");
      const body = await s.json();
      setSession({ companyId: body.companyId, userId: body.userId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      if (nav === "employees") {
        const data = await api("/employees");
        setEmployees(data.employees ?? []);
      } else if (nav === "leave") {
        const [types, reqs] = await Promise.all([
          api("/leave/types"),
          api("/leave/requests"),
        ]);
        setLeaveTypes(types.leaveTypes ?? []);
        setLeaveRequests(reqs.requests ?? []);
      } else if (nav === "payroll") {
        const data = await api("/payroll/periods");
        setPeriods(data.periods ?? []);
      } else if (nav === "policy") {
        const data = await api("/payroll/policy");
        setPolicy(data.policy);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [nav, session]);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createEmployee(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/employees", {
        method: "POST",
        body: JSON.stringify({
          fullName,
          joinDate,
          jobLevel,
          baseSalaryMinor: Number(baseSalaryMinor) || 0,
          workEmail: `${fullName.toLowerCase().replace(/\s+/g, ".")}.${Date.now()}@hr-fake.wolf.example`,
        }),
      });
      setFullName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function savePolicy(e: FormEvent) {
    e.preventDefault();
    if (!policy) return;
    try {
      const data = await api("/payroll/policy", {
        method: "PUT",
        body: JSON.stringify(policy),
      });
      setPolicy(data.policy);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createPeriod() {
    try {
      const code = new Date().toISOString().slice(0, 7);
      await api("/payroll/periods", {
        method: "POST",
        body: JSON.stringify({
          periodCode: `${code}-${Date.now().toString(36)}`,
          startDate: `${code}-01`,
          endDate: `${code}-28`,
          payDate: `${code}-28`,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function calcPeriod(id: string) {
    try {
      await api(`/payroll/periods/${id}/calculate`, { method: "POST", body: "{}" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading) {
    return <div className="empty">Loading session…</div>;
  }

  if (!session) {
    return (
      <div className="empty">
        <h2>ATRIUM HRIS</h2>
        <p className="muted">{error ?? "Sign in via Wolf portal and Open HR for a company."}</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>ATRIUM HRIS</h1>
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          Company session active
        </p>
        {(["employees", "leave", "payroll", "policy"] as Nav[]).map((k) => (
          <button key={k} className={nav === k ? "active" : ""} onClick={() => setNav(k)}>
            {k === "employees"
              ? "People"
              : k === "leave"
                ? "Leave"
                : k === "payroll"
                  ? "Payroll"
                  : "Company policy"}
          </button>
        ))}
      </aside>
      <main className="main">
        {error ? <p className="err">{error}</p> : null}

        {nav === "employees" ? (
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Employees</h2>
            </div>
            <form className="row" onSubmit={createEmployee} style={{ marginBottom: 16 }}>
              <input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
              <select value={jobLevel} onChange={(e) => setJobLevel(e.target.value)}>
                {["L1", "L2", "L3", "L4", "L5"].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                placeholder="Base salary (minor)"
                value={baseSalaryMinor}
                onChange={(e) => setBaseSalaryMinor(e.target.value)}
              />
              <button className="btn" type="submit">
                Add employee
              </button>
            </form>
            {employees.length === 0 ? (
              <div className="empty">No employees yet for this company.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th>Title</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.employment_id}>
                      <td>{e.employee_code}</td>
                      <td>{e.full_name}</td>
                      <td>{e.job_level}</td>
                      <td>{e.job_title || "—"}</td>
                      <td>{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {nav === "leave" ? (
          <div className="panel">
            <h2>Leave</h2>
            <p className="muted">Types are company-scoped and configurable.</p>
            <ul>
              {leaveTypes.map((t) => (
                <li key={t.id}>
                  {t.code} — {t.name} ({t.category}) entitlement {t.default_entitlement}
                </li>
              ))}
            </ul>
            <h3>Requests</h3>
            {leaveRequests.length === 0 ? (
              <div className="empty">No leave requests.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.employee_code} {r.full_name}
                      </td>
                      <td>{r.leave_type_name}</td>
                      <td>
                        {r.start_date} → {r.end_date}
                      </td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {nav === "payroll" ? (
          <div className="panel">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Payroll periods</h2>
              <button className="btn" type="button" onClick={() => void createPeriod()}>
                New period
              </button>
            </div>
            {periods.length === 0 ? (
              <div className="empty">No payroll periods.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>SC pool (minor)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id}>
                      <td>{p.period_code}</td>
                      <td>{p.status}</td>
                      <td>{p.service_charge_pool_minor}</td>
                      <td>
                        {p.status === "DRAFT" || p.status === "CALCULATED" ? (
                          <button className="btn secondary" type="button" onClick={() => void calcPeriod(p.id)}>
                            Calculate
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {nav === "policy" && policy ? (
          <div className="panel">
            <h2>Company payroll policy</h2>
            <p className="muted">Rates and service charge mode apply only to this company.</p>
            <form onSubmit={savePolicy}>
              <div className="row" style={{ marginBottom: 12 }}>
                <label>
                  PPh21 rate{" "}
                  <input
                    type="number"
                    step="0.001"
                    value={policy.pph21_flat_rate}
                    onChange={(e) =>
                      setPolicy({ ...policy, pph21_flat_rate: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Service charge mode{" "}
                  <select
                    value={policy.service_charge_mode}
                    onChange={(e) =>
                      setPolicy({ ...policy, service_charge_mode: e.target.value })
                    }
                  >
                    <option value="equal">equal</option>
                    <option value="by_level">by_level</option>
                    <option value="off">off</option>
                  </select>
                </label>
                <label>
                  Default SC pool (minor){" "}
                  <input
                    type="number"
                    value={policy.service_charge_default_pool_minor}
                    onChange={(e) =>
                      setPolicy({
                        ...policy,
                        service_charge_default_pool_minor: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <button className="btn" type="submit">
                Save policy
              </button>
            </form>
          </div>
        ) : null}
      </main>
    </div>
  );
}
