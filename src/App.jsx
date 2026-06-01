import { useState, useRef, useCallback, useEffect } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = "https://list-upload-normalisation-assistant.vercel.app";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0f0f13", sidebar: "#16161e", card: "#1e1e2a", cardBorder: "#2a2a3a",
  orange: "#ff6b35", purple: "#a855f7", yellow: "#ffd60a", neon: "#39ff14",
  pink: "#ff3c9e", teal: "#00d4ff", coral: "#ff6b4a",
  text: "#f0f0f8", muted: "#8888aa", danger: "#ff4d4d",
};
const ACCENT = [T.orange, T.purple, T.yellow, T.teal, T.pink];

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const ls = {
  get: (k, fb) => {
    if (typeof window === "undefined") return fb;
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; }
  },
  set: (k, v) => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { }
  },
};

const DEFAULT_SETTINGS = {
  clientId: "", clientSecret: "", munchkinId: "", restUrl: "",
  batchSize: 300, intervalSec: 20, retryAttempts: 3, retryDelaySec: 30,
  sanctionedCountries: [],
  picklistRules: [],
  requiredImportFields: ["email"], // Marketo REST field names that must be mapped before import
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const card = { background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: "1.5rem" };
const inp = { background: "#0f0f13", border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "10px 14px", color: T.text, fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" };
const lbl = { fontSize: 12, color: T.muted, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
const btn = (color = T.orange) => ({ background: color, color: color === T.yellow ? "#0f0f13" : "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" });
const ghost = { background: "transparent", border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: "10px 20px", fontSize: 14, color: T.muted, cursor: "pointer" };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    success: [T.neon, "#0f2a0f"], complete: [T.neon, "#0f2a0f"],
    failed: [T.danger, "#2a0f0f"], partial: [T.yellow, "#2a250f"],
    uploading: [T.teal, "#0f2a2a"], pending: [T.muted, "#1e1e2a"],
  };
  const [fg, bg] = map[status] || map.pending;
  return <span style={{ background: bg, color: fg, border: `1px solid ${fg}33`, fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{status}</span>;
}

function Metric({ label, value, color }) {
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8, borderTop: `3px solid ${color}` }}>
      <span style={{ fontSize: 12, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function SearchDropdown({ options, value, onChange, placeholder, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const selected = options.find(o => String(o.id) === String(value));
  const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => !disabled && setOpen(o => !o)} style={{ ...inp, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 }}>
        <span style={{ color: selected ? T.text : T.muted }}>{selected ? selected.name : placeholder}</span>
        <span style={{ color: T.muted, fontSize: 12 }}>▾</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, zIndex: 100, maxHeight: 280, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${T.cardBorder}` }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search programs..." style={{ ...inp, padding: "7px 10px" }} />
          </div>
          <div style={{ overflowY: "auto", maxHeight: 220 }}>
            {filtered.length === 0
              ? <div style={{ padding: "12px 14px", color: T.muted, fontSize: 13 }}>No results</div>
              : filtered.map(o => (
                <div key={o.id}
                  onClick={() => { onChange(String(o.id)); setOpen(false); setQuery(""); }}
                  style={{ padding: "10px 14px", fontSize: 14, color: T.text, cursor: "pointer", borderBottom: `1px solid ${T.cardBorder}22` }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff10"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {o.name}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const COMMON_FIELDS = [
  { rest: "email", display: "Email" }, { rest: "firstName", display: "First name" },
  { rest: "lastName", display: "Last name" }, { rest: "company", display: "Company" },
  { rest: "title", display: "Job title" }, { rest: "phone", display: "Phone" },
  { rest: "mobilePhone", display: "Mobile phone" }, { rest: "city", display: "City" },
  { rest: "state", display: "State" }, { rest: "country", display: "Country" },
  { rest: "postalCode", display: "Postal code" }, { rest: "website", display: "Website" },
  { rest: "industry", display: "Industry" }, { rest: "leadSource", display: "Lead source" },
  { rest: "department", display: "Department" }, { rest: "numberOfEmployees", display: "Employees" },
];

const FALLBACK_STATUSES = ["Member", "Attended", "Registered", "On List", "Invited", "Waitlisted", "No Show"];

function autoMap(header, fields) {
  const h = header.toLowerCase().replace(/[\s_-]/g, "");
  return fields.find(f =>
    f.rest.toLowerCase().replace(/[\s_-]/g, "") === h ||
    f.display.toLowerCase().replace(/[\s_-]/g, "") === h
  )?.rest || "";
}

function FieldMapping({ csvHeaders, marketoFields, mapping, onChange, requiredFields = ["email"] }) {
  useEffect(() => {
    const initial = {};
    csvHeaders.forEach(h => { initial[h] = autoMap(h, marketoFields); });
    onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mappedValues = Object.values(mapping);
  const unmapped = csvHeaders.filter(h => !mapping[h]);
  const missingRequired = requiredFields.filter(f => !mappedValues.includes(f));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: T.muted }}>Map your CSV columns to Marketo fields</span>
        {unmapped.length > 0 && (
          <span style={{ background: "#2a1509", color: T.coral, border: `1px solid ${T.coral}44`, fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>
            {unmapped.length} unmapped
          </span>
        )}
      </div>
      {missingRequired.length > 0 && (
        <div style={{ background: "#2a0f0f", border: `1px solid ${T.danger}66`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.danger, fontWeight: 600 }}>
          Required fields not mapped: <strong>{missingRequired.join(", ")}</strong> — these must be mapped to proceed.
          {missingRequired.includes("email") && <span style={{ fontWeight: 400, display: "block", marginTop: 4 }}>Email is used to match existing records and avoid duplicates.</span>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: "8px 12px", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>CSV column</div>
        <div />
        <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Marketo field</div>
        {csvHeaders.map(h => {
          const mapped = mapping[h] || "";
          const isUnmapped = !mapped;
          const isRequired = requiredFields.includes(mapped);
          return [
            <div key={`csv-${h}`} style={{ background: "#0f0f13", border: `1px solid ${isRequired ? T.neon + "88" : isUnmapped ? T.coral + "66" : T.cardBorder}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: isUnmapped ? T.coral : T.text }}>{h}</div>,
            <div key={`arr-${h}`} style={{ textAlign: "center", color: mapped ? T.neon : T.coral, fontSize: 16 }}>{mapped ? "→" : "⚠"}</div>,
            <select key={`sel-${h}`} value={mapped} onChange={e => onChange({ ...mapping, [h]: e.target.value })}
              style={{ ...inp, border: `1px solid ${isRequired ? T.neon + "88" : isUnmapped ? T.coral + "66" : T.cardBorder}`, color: mapped ? T.text : T.muted }}>
              <option value="">— skip this field —</option>
              {marketoFields.map(f => <option key={f.rest} value={f.rest}>{f.display} ({f.rest})</option>)}
            </select>,
          ];
        })}
      </div>
      {unmapped.length > 0 && (
        <div style={{ background: "#2a1509", border: `1px solid ${T.coral}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.coral }}>
          ⚠ {unmapped.length} column{unmapped.length > 1 ? "s" : ""} not mapped — they will be skipped.
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ logs, errors }) {
  const total = logs.length;
  const success = logs.filter(l => l.status === "success" || l.status === "complete").length;
  const failed = logs.filter(l => l.status === "failed").length;
  const processed = logs.reduce((a, l) => a + (l.processedRecords || 0), 0);
  const recent = [...logs].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 6);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Dashboard</h2>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>Upload health and recent activity</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Metric label="Total uploads" value={total} color={T.purple} />
        <Metric label="Successful" value={success} color={T.neon} />
        <Metric label="Failed" value={failed} color={T.danger} />
        <Metric label="Records in" value={processed.toLocaleString()} color={T.teal} />
        <Metric label="Errors logged" value={errors.length} color={T.orange} />
      </div>
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: T.text }}>Recent uploads</h3>
        {recent.length === 0
          ? <div style={{ ...card, color: T.muted, fontSize: 14, textAlign: "center", padding: "2rem" }}>No uploads yet.</div>
          : recent.map((l, i) => (
            <div key={l.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "14px 18px", marginBottom: 8, borderLeft: `3px solid ${ACCENT[i % ACCENT.length]}` }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: T.text }}>{l.listName}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>{l.programName} · {new Date(l.startedAt).toLocaleString()}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: T.muted }}>{(l.processedRecords || 0).toLocaleString()} / {(l.totalRecords || 0).toLocaleString()}</span>
                <Badge status={l.status} />
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── UPLOAD QUEUE ─────────────────────────────────────────────────────────────
function UploadQueue({ jobs, abortMap, onClearDone }) {
  const active = jobs.filter(j => j.status === "uploading");
  const done = jobs.filter(j => j.status !== "uploading");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Upload Queue</h2>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>
            {active.length > 0 ? `${active.length} active` : "No active uploads"}{done.length > 0 ? ` · ${done.length} completed` : ""}
          </p>
        </div>
        {done.length > 0 && <button onClick={onClearDone} style={{ ...ghost, fontSize: 13 }}>Clear completed</button>}
      </div>

      {jobs.length === 0 && (
        <div style={{ ...card, color: T.muted, fontSize: 14, textAlign: "center", padding: "3rem" }}>
          No uploads yet. Go to Upload to start one.
        </div>
      )}

      {active.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Active</p>
          {active.map((job, i) => {
            const pct = job.batchesTotal > 0 ? Math.round((job.batchesDone / job.batchesTotal) * 100) : 0;
            return (
              <div key={job.id} style={{ ...card, marginBottom: 10, borderLeft: `3px solid ${T.teal}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.text }}>{job.listName}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted }}>{job.programName} · {job.memberStatus}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.teal, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                    <Badge status="uploading" />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted, marginBottom: 6 }}>
                    <span>Batch {job.batchesDone} of {job.batchesTotal}</span>
                    <span>{pct}% · {job.recordsImported.toLocaleString()} records imported</span>
                  </div>
                  <div style={{ height: 8, background: "#1e1e2a", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.purple}, ${T.teal})`, borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: T.muted }}>Started {new Date(job.startedAt).toLocaleTimeString()}</span>
                  <button onClick={() => { abortMap.current[job.id] = true; }} style={{ ...btn(T.danger), padding: "6px 14px", fontSize: 12 }}>Cancel</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {done.length > 0 && (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Completed</p>
          {done.map((job, i) => {
            const duration = job.finishedAt ? Math.round((new Date(job.finishedAt) - new Date(job.startedAt)) / 1000) : null;
            const accent = job.status === "complete" ? T.neon : job.status === "partial" ? T.yellow : T.danger;
            return (
              <div key={job.id} style={{ ...card, marginBottom: 8, borderLeft: `3px solid ${accent}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: T.text }}>{job.listName}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted }}>{job.programName} · {job.memberStatus}</p>
                  </div>
                  <Badge status={job.status} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 13, color: T.muted }}>
                  <span>Records: <strong style={{ color: T.text }}>{job.recordsImported.toLocaleString()} / {job.totalRecords.toLocaleString()}</strong></span>
                  <span>Batches: <strong style={{ color: T.text }}>{job.batchesDone} / {job.batchesTotal}</strong></span>
                  {duration && <span>Duration: <strong style={{ color: T.text }}>{duration}s</strong></span>}
                  <span>Started: <strong style={{ color: T.text }}>{new Date(job.startedAt).toLocaleTimeString()}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

// ─── UPLOAD PANEL (form only — upload runs at App level) ──────────────────────
const MEMBER_STATUSES_DEFAULT = FALLBACK_STATUSES;

function UploadPanel({ settings, onSubmit, preloadedCsv, onPreloadConsumed }) {
  const [step, setStep] = useState(1);
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [memberStatus, setMemberStatus] = useState(FALLBACK_STATUSES[0]);
  const [memberStatuses, setMemberStatuses] = useState(FALLBACK_STATUSES);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [marketoFields, setMarketoFields] = useState(COMMON_FIELDS);
  const [mapping, setMapping] = useState({});
  const [submitError, setSubmitError] = useState("");

  const getCreds = useCallback(() => {
    const { restUrl, clientId, clientSecret } = settings;
    if (!restUrl || !clientId || !clientSecret) throw new Error("Credentials not configured. Go to Settings.");
    return { restUrl, clientId, clientSecret };
  }, [settings]);

  useEffect(() => {
    if (!preloadedCsv) return;
    setCsvData(preloadedCsv);
    setFile({ name: preloadedCsv.filename || "normalized.csv" });
    fetchMarketoFields();
    setStep(3);
    onPreloadConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedCsv]);

  const fetchPrograms = async () => {
    setLoadingPrograms(true);
    try {
      const data = await apiPost("/api/programs", getCreds());
      setPrograms(data.programs);
    } catch (err) {
      alert(`Could not fetch programs: ${err.message}`);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchStatuses = async (programId) => {
    const program = programs.find(p => String(p.id) === String(programId));
    if (!program?.channel) return;
    setLoadingStatuses(true);
    try {
      const data = await apiPost("/api/statuses", { ...getCreds(), channel: program.channel });
      if (data.statuses?.length > 0) {
        setMemberStatuses(data.statuses);
        setMemberStatus(data.statuses[0]);
      }
    } catch {
      // keep fallback
    } finally {
      setLoadingStatuses(false);
    }
  };

  const fetchMarketoFields = async () => {
    try {
      const data = await apiPost("/api/fields", getCreds());
      if (data.fields && data.fields.length > 0) setMarketoFields(data.fields);
    } catch {
      // keep common fields fallback
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        return obj;
      });
      setCsvData({ headers, rows });
      fetchMarketoFields();
      setStep(3);
    };
    reader.readAsText(f);
  };

  const remapRow = (row) => {
    const out = {};
    Object.entries(mapping).forEach(([csvCol, mktoField]) => {
      if (mktoField && row[csvCol] !== undefined) out[mktoField] = row[csvCol];
    });
    return out;
  };

  const handleSubmit = () => {
    setSubmitError("");
    const mappedRows = csvData.rows.map(remapRow).filter(r => Object.keys(r).length > 0);
    if (mappedRows.length === 0) { setSubmitError("No mapped fields — map at least one CSV column."); return; }
    const missing = requiredFields.filter(f => !Object.values(mapping).includes(f));
    if (missing.length > 0) { setSubmitError(`Required fields not mapped: ${missing.join(", ")}`); return; }

    const programName = programs.find(p => String(p.id) === String(selectedProgram))?.name || selectedProgram;

    onSubmit({
      creds: getCreds(),
      programId: selectedProgram,
      programName,
      memberStatus,
      mappedRows,
      filename: file.name,
      batchSize: settings.batchSize,
      intervalSec: settings.intervalSec,
      retryAttempts: settings.retryAttempts,
      retryDelaySec: settings.retryDelaySec,
      sanctionedCountries: settings.sanctionedCountries || [],
    });

    // Reset form immediately so user can queue another upload
    reset();
  };

  const reset = () => {
    setStep(1); setFile(null); setCsvData(null); setMapping({});
    setSelectedProgram(""); setSubmitError("");
    setMemberStatuses(FALLBACK_STATUSES); setMemberStatus(FALLBACK_STATUSES[0]);
  };

  const programSelected = programs.find(p => String(p.id) === String(selectedProgram));
  const requiredFields = settings.requiredImportFields?.length ? settings.requiredImportFields : ["email"];
  const mappedValues = Object.values(mapping);
  const allRequiredMapped = requiredFields.every(f => mappedValues.includes(f));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Upload list</h2>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>Configure and queue a new upload — you can queue multiple lists at once</p>
      </div>

      {/* STEP INDICATORS */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {["Program", "CSV file", "Field mapping", "Confirm"].map((s, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          const color = done ? T.neon : active ? T.orange : T.muted;
          return [
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? T.neon : active ? T.orange : "transparent", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: done ? "#0f0f13" : active ? "#0f0f13" : T.muted }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 13, color, fontWeight: active ? 600 : 400 }}>{s}</span>
            </div>,
            i < 3 && <div key={`d${i}`} style={{ flex: 1, height: 1, background: step > n ? T.neon : T.cardBorder }} />,
          ];
        })}
      </div>

      {/* STEP 1 */}
      <div style={{ ...card, opacity: step >= 1 ? 1 : 0.4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.orange }}>Step 1 — Select program</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: T.muted }}>Choose the target Marketo program and member status</p>
          </div>
          {programSelected && <Badge status="success" />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Marketo program</label>
            <SearchDropdown options={programs} value={selectedProgram} onChange={(v) => { setSelectedProgram(v); fetchStatuses(v); }} placeholder="Search and select a program..." disabled={programs.length === 0} />
          </div>
          <div>
            <label style={lbl}>Member status {loadingStatuses && <span style={{ color: T.muted, fontWeight: 400 }}>loading...</span>}</label>
            <select value={memberStatus} onChange={e => setMemberStatus(e.target.value)} style={inp} disabled={loadingStatuses}>
              {memberStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={fetchPrograms} disabled={loadingPrograms} style={btn(T.purple)}>
            {loadingPrograms ? "Loading..." : programs.length > 0 ? `${programs.length} programs — refresh` : "Fetch programs"}
          </button>
          {selectedProgram && <button onClick={() => setStep(2)} style={btn(T.orange)}>Next: Upload CSV →</button>}
        </div>
      </div>

      {/* STEP 2 */}
      <div style={{ ...card, opacity: step >= 2 ? 1 : 0.4, pointerEvents: step >= 2 ? "auto" : "none" }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.teal }}>Step 2 — Upload CSV file</p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>First row must be column headers. Max 10 MB.</p>
        <input type="file" accept=".csv" onChange={handleFile} style={{ fontSize: 14, color: T.text }} />
        {csvData && (
          <div style={{ marginTop: 12, background: "#092a25", border: `1px solid ${T.teal}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.teal }}>
            ✓ {csvData.rows.length.toLocaleString()} records · {csvData.headers.length} columns: {csvData.headers.join(", ")}
          </div>
        )}
      </div>

      {/* STEP 3 */}
      {step >= 3 && csvData && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.yellow }}>Step 3 — Map fields</p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>Auto-matched where possible. Fix any flagged columns.</p>
          <FieldMapping csvHeaders={csvData.headers} marketoFields={marketoFields} mapping={mapping} onChange={setMapping} requiredFields={requiredFields} />
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setStep(4)}
              disabled={!allRequiredMapped}
              style={{ ...btn(T.yellow), opacity: allRequiredMapped ? 1 : 0.4, cursor: allRequiredMapped ? "pointer" : "not-allowed" }}
            >
              Confirm mapping → Review upload
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step >= 4 && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.neon }}>Step 4 — Confirm & queue</p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>Review the details below, then add to queue. You can queue more uploads immediately after.</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16, fontSize: 13, color: T.muted }}>
            <span>Program: <strong style={{ color: T.text }}>{programSelected?.name}</strong></span>
            <span>Status: <strong style={{ color: T.text }}>{memberStatus}</strong></span>
            <span>Records: <strong style={{ color: T.text }}>{csvData.rows.length.toLocaleString()}</strong></span>
            <span>Batch size: <strong style={{ color: T.text }}>{settings.batchSize}</strong></span>
            <span>Mapped fields: <strong style={{ color: T.neon }}>{Object.values(mapping).filter(Boolean).length}</strong></span>
          </div>
          {submitError && (
            <div style={{ marginBottom: 12, background: "#2a0f0f", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.danger }}>
              ✗ {submitError}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSubmit} style={btn(T.neon)}>Add to queue →</button>
            <button onClick={reset} style={ghost}>Start over</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UPLOAD LOGS ──────────────────────────────────────────────────────────────
function UploadLogs({ logs, onClear }) {
  const sorted = [...logs].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Upload logs</h2>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>History of all batch uploads</p>
        </div>
        {logs.length > 0 && <button onClick={onClear} style={{ ...ghost, color: T.danger, borderColor: T.danger + "44" }}>Clear all</button>}
      </div>
      {sorted.length === 0
        ? <div style={{ ...card, color: T.muted, fontSize: 14, textAlign: "center", padding: "2rem" }}>No upload history yet.</div>
        : sorted.map((l, i) => (
          <div key={l.id} style={{ ...card, marginBottom: 8, borderLeft: `3px solid ${ACCENT[i % ACCENT.length]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: T.text }}>{l.listName}</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: T.muted }}>{l.programName} · {l.memberStatus}</p>
              </div>
              <Badge status={l.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
              {[
                ["Records", `${(l.processedRecords || 0).toLocaleString()} / ${(l.totalRecords || 0).toLocaleString()}`],
                ["Batches", `${l.batchesDone || 0} / ${l.batchesTotal || 0}`],
                ["Started", new Date(l.startedAt).toLocaleString()],
                l.finishedAt ? ["Duration", `${Math.round((new Date(l.finishedAt) - new Date(l.startedAt)) / 1000)}s`] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k} style={{ background: "#0f0f13", borderRadius: 8, padding: "8px 12px" }}>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: T.text }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── ERROR LOGS ───────────────────────────────────────────────────────────────
function ErrorLogs({ errors, onClear }) {
  const sorted = [...errors].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Error logs</h2>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>Failed batches and API errors</p>
        </div>
        {errors.length > 0 && <button onClick={onClear} style={{ ...ghost, color: T.danger, borderColor: T.danger + "44" }}>Clear all</button>}
      </div>
      {sorted.length === 0
        ? <div style={{ ...card, color: T.neon, fontSize: 14, textAlign: "center", padding: "2rem" }}>✓ No errors. All clear.</div>
        : sorted.map(e => (
          <div key={e.id} style={{ ...card, marginBottom: 8, borderLeft: `3px solid ${T.danger}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: T.danger }}>{e.errorCode}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>{e.listName} · Batch {e.batchIndex}</p>
              </div>
              <span style={{ fontSize: 12, color: T.muted }}>{new Date(e.timestamp).toLocaleString()}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 8 }}>
              {e.leadId && (
                <div style={{ background: "#0f0f13", borderRadius: 8, padding: "7px 12px" }}>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lead ID</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: T.text }}>{e.leadId}</p>
                </div>
              )}
              {e.email && (
                <div style={{ background: "#0f0f13", borderRadius: 8, padding: "7px 12px" }}>
                  <p style={{ margin: 0, fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: T.text }}>{e.email}</p>
                </div>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.text, background: "#0f0f13", borderRadius: 8, padding: "8px 12px" }}>{e.message}</p>
          </div>
        ))
      }
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({ settings, onChange }) {
  const [local, setLocal] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setLocal(l => ({ ...l, [k]: v }));
  const save = () => { onChange(local); ls.set("mkto_settings", local); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const testConnection = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { clientId, clientSecret, restUrl } = local;
      if (!clientId || !clientSecret || !restUrl) throw new Error("Fill in Client ID, Client Secret and REST URL first.");
      await apiPost("/api/auth", { clientId, clientSecret, restUrl });
      setTestResult({ ok: true, msg: "Connected successfully." });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally { setTesting(false); }
  };

  const F = ({ k, label, type = "text", hint = "" }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={lbl}>{label}</label>
      <input type={type} value={local[k] || ""} onChange={e => set(k, type === "number" ? Number(e.target.value) : e.target.value)} placeholder={hint} style={inp} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Settings</h2>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>Marketo connection and upload configuration</p>
      </div>
      <div style={{ ...card, borderTop: `3px solid ${T.teal}` }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.teal }}>Marketo connection</p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>Saved in your browser only. Never in code.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <F k="clientId" label="Client ID" hint="Admin → Integration → LaunchPoint → View Details" />
          <F k="clientSecret" label="Client secret" type="password" hint="Admin → Integration → LaunchPoint → View Details" />
          <F k="munchkinId" label="Munchkin ID" hint="000-AAA-000" />
          <F k="restUrl" label="REST endpoint URL" hint="https://000-AAA-000.mktorest.com/rest" />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={testConnection} disabled={testing} style={btn(T.purple)}>{testing ? "Testing..." : "Test connection"}</button>
          {testResult && <span style={{ fontSize: 13, color: testResult.ok ? T.neon : T.danger }}>{testResult.ok ? "✓" : "✗"} {testResult.msg}</span>}
        </div>
      </div>
      <div style={{ ...card, borderTop: `3px solid ${T.orange}` }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.orange }}>Upload configuration</p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>Control batch size, pacing and retry behaviour.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F k="batchSize" label="Batch size (records)" type="number" />
          <F k="intervalSec" label="Interval between batches (sec)" type="number" />
          <F k="retryAttempts" label="Max retries" type="number" />
          <F k="retryDelaySec" label="Retry delay (sec)" type="number" />
        </div>
        <div style={{ marginTop: 16, background: "#0f0f13", borderRadius: 10, padding: "12px 16px", fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
          <strong style={{ color: T.text }}>Marketo limits:</strong> 100 requests / 20 sec · 10 concurrent calls · Bulk queue: max 10 jobs · Max file: 10 MB
        </div>
      </div>
      {/* ── Data Rules ─────────────────────────────────────────────────── */}
      <div style={{ ...card, borderTop: `3px solid ${T.pink}` }}>
        <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.pink }}>Data rules</p>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>Applied during normalization. Flagged rows are highlighted and can be excluded before upload.</p>

        {/* Required import fields */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Required fields during import</label>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: T.muted }}>Marketo REST field names that must be mapped before an upload can proceed. One per line. <strong style={{ color: T.text }}>email</strong> is always required and cannot be removed.</p>
          <textarea
            value={(local.requiredImportFields || ["email"]).filter(f => f !== "email").join("\n")}
            onChange={e => {
              const extra = e.target.value.split("\n").map(v => v.trim()).filter(Boolean);
              setLocal(l => ({ ...l, requiredImportFields: ["email", ...extra] }));
            }}
            rows={3}
            style={{ ...inp, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
            placeholder={"leadSource\npersonSource"}
          />
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>
            Currently required: <strong style={{ color: T.text }}>{(local.requiredImportFields || ["email"]).join(", ")}</strong>
          </p>
        </div>

        {/* Sanctioned countries */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Sanctioned / excluded countries</label>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: T.muted }}>One country per line. Records matching these are flagged in Normalize and silently dropped during import.</p>
          <textarea
            value={(local.sanctionedCountries || []).join("\n")}
            onChange={e => setLocal(l => ({ ...l, sanctionedCountries: e.target.value.split("\n").map(v => v.trim()).filter(Boolean) }))}
            rows={5}
            style={{ ...inp, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
            placeholder={"Cuba\nIran\nNorth Korea\nRussia\nSyria"}
          />
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>{(local.sanctionedCountries || []).length} countries configured</p>
        </div>

        {/* Picklist rules */}
        <div>
          <label style={lbl}>Restricted picklist fields</label>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted }}>
            Define fields with fixed allowed values (e.g. Person Source). Records with values outside the list are flagged in Normalize. Column name must match your CSV header exactly.
          </p>
          {(local.picklistRules || []).map((rule, i) => (
            <div key={i} style={{ background: "#0f0f13", borderRadius: 10, padding: "12px 14px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>CSV column name</label>
                  <input
                    value={rule.csvColumn}
                    onChange={e => setLocal(l => { const r = [...l.picklistRules]; r[i] = { ...r[i], csvColumn: e.target.value }; return { ...l, picklistRules: r }; })}
                    placeholder="e.g. Person Source"
                    style={inp}
                  />
                </div>
                <button
                  onClick={() => setLocal(l => { const r = l.picklistRules.filter((_, j) => j !== i); return { ...l, picklistRules: r }; })}
                  style={{ ...ghost, padding: "8px 12px", marginTop: 20, color: T.danger, borderColor: T.danger + "44", fontSize: 12 }}
                >Remove</button>
              </div>
              <div>
                <label style={lbl}>Allowed values (one per line)</label>
                <textarea
                  value={(rule.allowedValues || []).join("\n")}
                  onChange={e => setLocal(l => { const r = [...l.picklistRules]; r[i] = { ...r[i], allowedValues: e.target.value.split("\n").map(v => v.trim()).filter(Boolean) }; return { ...l, picklistRules: r }; })}
                  rows={4}
                  style={{ ...inp, fontFamily: "monospace", fontSize: 13, resize: "vertical" }}
                  placeholder={"Web\nEvent\nPartner\nPaid Media"}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => setLocal(l => ({ ...l, picklistRules: [...(l.picklistRules || []), { csvColumn: "", allowedValues: [] }] }))}
            style={{ ...ghost, fontSize: 13 }}
          >+ Add picklist rule</button>
        </div>
      </div>

      <button onClick={save} style={{ ...btn(saved ? T.neon : T.orange), alignSelf: "flex-start", color: saved ? "#0f0f13" : "#fff" }}>
        {saved ? "✓ Saved" : "Save settings"}
      </button>
    </div>
  );
}

// ─── NORMALIZE ────────────────────────────────────────────────────────────────
const normHeader = (h) => h.toLowerCase().replace(/[\s_-]/g, "");

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com",
  "protonmail.com", "yahoo.co.in", "rediffmail.com", "live.com", "msn.com", "ymail.com", "mail.com",
]);

const ROLE_PREFIXES = [
  "info", "support", "hello", "contact", "admin", "sales", "marketing", "team", "help", "billing",
  "noreply", "no-reply", "enquiries", "enquiry", "hr", "careers", "press", "media", "legal", "finance",
  "accounts", "reception", "office",
];

const IN_STATE_ABBREV = {
  AN: "Andaman and Nicobar Islands", AP: "Andhra Pradesh", AR: "Arunachal Pradesh",
  AS: "Assam", BR: "Bihar", CH: "Chandigarh", CT: "Chhattisgarh", DN: "Dadra and Nagar Haveli",
  DD: "Daman and Diu", DL: "Delhi", GA: "Goa", GJ: "Gujarat", HR: "Haryana",
  HP: "Himachal Pradesh", JK: "Jammu and Kashmir", JH: "Jharkhand", KA: "Karnataka",
  KL: "Kerala", LA: "Ladakh", LD: "Lakshadweep", MP: "Madhya Pradesh", MH: "Maharashtra",
  MN: "Manipur", ML: "Meghalaya", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha",
  PY: "Puducherry", PB: "Punjab", RJ: "Rajasthan", SK: "Sikkim", TN: "Tamil Nadu",
  TS: "Telangana", TR: "Tripura", UP: "Uttar Pradesh", UK: "Uttarakhand", WB: "West Bengal",
};

const US_STATE_ABBREV = {
  CA: "California", NY: "New York", TX: "Texas", FL: "Florida", IL: "Illinois", WA: "Washington",
  MA: "Massachusetts", CO: "Colorado", GA: "Georgia", VA: "Virginia", NC: "North Carolina",
  NJ: "New Jersey", AZ: "Arizona", OH: "Ohio", PA: "Pennsylvania", MI: "Michigan", MN: "Minnesota",
  OR: "Oregon", TN: "Tennessee", MO: "Missouri", MD: "Maryland", WI: "Wisconsin", CT: "Connecticut",
  NV: "Nevada", IN: "Indiana", UT: "Utah", KY: "Kentucky", SC: "South Carolina", AL: "Alabama",
  LA: "Louisiana", OK: "Oklahoma", IA: "Iowa", KS: "Kansas", AR: "Arkansas", MS: "Mississippi",
  NE: "Nebraska", NM: "New Mexico", ID: "Idaho", HI: "Hawaii", NH: "New Hampshire", ME: "Maine",
  RI: "Rhode Island", MT: "Montana", DE: "Delaware", SD: "South Dakota", ND: "North Dakota",
  AK: "Alaska", VT: "Vermont", WY: "Wyoming", DC: "District of Columbia",
};

function findCol(headers, matchers) {
  return headers.find(h => matchers.includes(normHeader(h))) || null;
}

function toProperCase(str) {
  if (!str) return str;
  return str.split(/(\s+|-)/).map(part => {
    if (!part || part === " " || part === "-") return part;
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join("");
}

function sanitizeNameValue(val) {
  const sanitized = val.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-']/g, "");
  return sanitized === "" ? val : sanitized;
}

function isRoleBasedEmail(email) {
  const local = email.split("@")[0]?.toLowerCase() || "";
  return ROLE_PREFIXES.some(p => local === p || local.startsWith(p));
}

function normalizeCountry(val) {
  const key = val.trim().replace(/\./g, "").toLowerCase().replace(/\s+/g, "");
  const aliases = {
    us: "United States", usa: "United States", unitedstates: "United States",
    unitedstatesofamerica: "United States",
    uk: "United Kingdom", england: "United Kingdom", britain: "United Kingdom", greatbritain: "United Kingdom",
    uae: "United Arab Emirates", unitedarabemirates: "United Arab Emirates",
    in: "India",
    ir: "Ireland", ireland: "Ireland",
    ca: "Canada", canada: "Canada",
    au: "Australia", australia: "Australia",
    de: "Germany", germany: "Germany",
    fr: "France", france: "France",
    sg: "Singapore", singapore: "Singapore",
    jp: "Japan", japan: "Japan",
  };
  if (aliases[key]) return aliases[key];
  const upper = val.trim().toUpperCase();
  if (upper === "US" || upper === "USA" || upper === "U.S.A.") return "United States";
  if (upper === "UK" || upper === "U.K.") return "United Kingdom";
  if (upper === "UAE" || upper === "U.A.E.") return "United Arab Emirates";
  if (upper === "IN") return "India";
  return val;
}

// Minimum digit lengths for a valid number by country (excluding country code)
const MIN_PHONE_DIGITS = { default: 7, IN: 10, US: 10, CA: 10, GB: 10, IE: 9, AU: 9 };

function normalizePhone(val, country = "") {
  const v = val.trim();
  if (!v) return "";
  const hasPlus = v.startsWith("+");
  const digitStr = v.replace(/\D/g, "");

  // Determine country code context
  const c = country.toLowerCase();
  const isIndia = c === "india" || c === "in";
  const isIreland = c === "ireland" || c === "ie";
  const isUK = c === "united kingdom" || c === "uk" || c === "gb";
  const isCanada = c === "canada" || c === "ca";
  const isAustralia = c === "australia" || c === "au";

  // Already has +, keep as-is if valid length, else clear
  if (hasPlus) {
    return digitStr.length >= 7 ? "+" + digitStr : "";
  }

  // India: expect 10-digit mobile number, prepend +91
  if (isIndia) {
    const local = digitStr.startsWith("91") && digitStr.length === 12 ? digitStr.slice(2) : digitStr;
    if (local.length === 10) return "+91" + local;
    return ""; // incomplete — clear
  }

  // Ireland: expect 9-digit number, prepend +353
  if (isIreland) {
    if (digitStr.startsWith("353") && digitStr.length >= 12) return "+" + digitStr;
    const local = digitStr.startsWith("0") ? digitStr.slice(1) : digitStr;
    if (local.length >= 9) return "+353" + local;
    return "";
  }

  // UK: starts with 0, replace with +44
  if (isUK) {
    if (digitStr.startsWith("44") && digitStr.length >= 12) return "+" + digitStr;
    const local = digitStr.startsWith("0") ? digitStr.slice(1) : digitStr;
    if (local.length >= 10) return "+44" + local;
    return "";
  }

  // Canada / US: expect 10 digits
  if (isCanada) {
    if (digitStr.length === 10) return "+1" + digitStr;
    if (digitStr.length === 11 && digitStr.startsWith("1")) return "+" + digitStr;
    return ""; // incomplete — clear
  }

  // Australia
  if (isAustralia) {
    if (digitStr.startsWith("61") && digitStr.length >= 11) return "+" + digitStr;
    const local = digitStr.startsWith("0") ? digitStr.slice(1) : digitStr;
    if (local.length >= 9) return "+61" + local;
    return "";
  }

  // No country context — generic rules
  if (digitStr.length >= 11 && !digitStr.startsWith("00")) return "+" + digitStr;
  if (digitStr.startsWith("0") && digitStr.length > 1) return "+44" + digitStr.slice(1);
  if (digitStr.length === 10) return "+1" + digitStr;
  if (digitStr.length < 7) return ""; // too short to be valid — clear
  return digitStr;
}

function parseCsvFile(text) {
  const lines = text.trim().split("\n").filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return obj;
  });
  return { headers, rows };
}

function runCleanEngine(headers, rows, sanctionedCountries = [], picklistRules = []) {
  const emailCol = findCol(headers, ["email", "emailaddress", "emailid", "workemailaddress", "workemail", "emailaddress"]);
  const firstCol = findCol(headers, ["firstname"]);
  const lastCol = findCol(headers, ["lastname"]);
  const fullCol = findCol(headers, ["fullname", "name"]);
  const hasSeparateNames = firstCol || lastCol;
  const phoneCol = findCol(headers, ["phone", "mobile", "mobilephone", "phonenumber"]);
  const countryCol = findCol(headers, ["country"]);
  const stateCol = findCol(headers, ["state"]);
  const sanctionedSet = new Set(sanctionedCountries.map(c => c.toLowerCase().trim()));

  let outHeaders = [...headers];
  let firstNameCol = firstCol;
  let lastNameCol = lastCol;

  if (fullCol && !hasSeparateNames) {
    if (!firstNameCol) {
      firstNameCol = "First Name";
      if (!outHeaders.includes(firstNameCol)) outHeaders.push(firstNameCol);
    }
    if (!lastNameCol) {
      lastNameCol = "Last Name";
      if (!outHeaders.includes(lastNameCol)) outHeaders.push(lastNameCol);
    }
  }

  const cleanedRows = [];
  const meta = [];

  rows.forEach((origRow) => {
    const row = { ...origRow };
    const flags = { personal: false, roleBased: false, emptyEmail: false, missingLastName: false, sanctioned: false, picklistViolations: [] };
    const modified = new Set();
    let nameSplit = false;

    if (emailCol) {
      const raw = (origRow[emailCol] || "").trim();
      const lowered = raw.toLowerCase();
      if (!lowered) flags.emptyEmail = true;
      if (lowered !== raw) { row[emailCol] = lowered; modified.add(emailCol); }
      else row[emailCol] = lowered;
      if (lowered) {
        const domain = lowered.split("@")[1] || "";
        if (PERSONAL_DOMAINS.has(domain)) flags.personal = true;
        if (isRoleBasedEmail(lowered)) flags.roleBased = true;
      }
    }

    if (fullCol && !hasSeparateNames) {
      const full = (origRow[fullCol] || "").trim();
      if (full) {
        const spaceIdx = full.indexOf(" ");
        let first, last;
        if (spaceIdx === -1) {
          first = full;
          last = full;
          nameSplit = true;
        } else {
          first = full.slice(0, spaceIdx);
          last = full.slice(spaceIdx + 1).trim() || full;
          nameSplit = true;
        }
        const properFirst = sanitizeNameValue(toProperCase(first));
        const properLast = sanitizeNameValue(toProperCase(last));
        if (row[firstNameCol] !== properFirst) { row[firstNameCol] = properFirst; modified.add(firstNameCol); }
        if (row[lastNameCol] !== properLast) { row[lastNameCol] = properLast; modified.add(lastNameCol); }
      }
    }

    const nameCols = [firstCol, lastCol, firstNameCol, lastNameCol].filter(Boolean);
    const uniqueNameCols = [...new Set(nameCols)];
    uniqueNameCols.forEach(col => {
      if (col === fullCol && !hasSeparateNames) return;
      const v = (row[col] || "").trim();
      if (!v) return;
      const proper = sanitizeNameValue(toProperCase(v));
      if (proper !== v) { row[col] = proper; modified.add(col); }
      else row[col] = proper;
    });

    // Normalize country first so phone + state logic can use the resolved value
    if (countryCol && origRow[countryCol]) {
      const raw = origRow[countryCol].trim();
      const mapped = normalizeCountry(raw);
      if (mapped !== raw) { row[countryCol] = mapped; modified.add(countryCol); }
      else row[countryCol] = mapped;
    }

    if (phoneCol && origRow[phoneCol]) {
      const countryVal = countryCol ? (row[countryCol] || "").trim() : "";
      const normalized = normalizePhone(origRow[phoneCol], countryVal);
      if (normalized !== origRow[phoneCol]) { row[phoneCol] = normalized; modified.add(phoneCol); }
      else row[phoneCol] = normalized;
    }

    if (stateCol && origRow[stateCol]) {
      const countryVal = countryCol ? (row[countryCol] || "").trim() : "";
      const isIndia = countryVal === "India";
      const isUS = !countryVal || countryVal === "United States";
      const raw = origRow[stateCol].trim();
      const upper = raw.toUpperCase();
      if (isIndia) {
        const expanded = IN_STATE_ABBREV[upper];
        if (expanded && expanded !== raw) { row[stateCol] = expanded; modified.add(stateCol); }
      } else if (isUS) {
        const expanded = US_STATE_ABBREV[upper];
        if (expanded && expanded !== raw) { row[stateCol] = expanded; modified.add(stateCol); }
      }
    }

    // Sanctioned country check — after country normalization
    if (countryCol) {
      const countryVal = (row[countryCol] || "").trim().toLowerCase();
      if (countryVal && sanctionedSet.has(countryVal)) flags.sanctioned = true;
    }

    // Picklist rules — flag rows where a configured field has a value not in the allowed list
    picklistRules.forEach(rule => {
      if (!rule.csvColumn || !rule.allowedValues?.length) return;
      const col = headers.find(h => h === rule.csvColumn);
      if (!col) return;
      const val = (row[col] || "").trim();
      if (!val) return; // blank is not a violation — handle separately if needed
      const allowed = rule.allowedValues.map(v => v.trim().toLowerCase());
      if (!allowed.includes(val.toLowerCase())) {
        flags.picklistViolations.push({ field: col, value: val, allowed: rule.allowedValues });
      }
    });

    // Flag rows missing a last name — mandatory in Marketo, needs enrichment
    if (lastNameCol && !(row[lastNameCol] || "").trim()) flags.missingLastName = true;

    outHeaders.forEach(h => {
      if (!(h in row)) row[h] = origRow[h] || "";
    });

    cleanedRows.push(row);
    meta.push({ flags, modified: [...modified], nameSplit });
  });

  return { headers: outHeaders, rows: cleanedRows, originalRows: rows, meta };
}

function computeSummary(originalRows, cleanedRows, meta) {
  let rowsModified = 0;
  let personalCount = 0;
  let roleCount = 0;
  let emptyCount = 0;
  let namesSplit = 0;
  let fieldsCorrected = 0;
  let missingLastNameCount = 0;
  let sanctionedCount = 0;
  let picklistViolationCount = 0;

  meta.forEach((m, i) => {
    if (m.flags.personal) personalCount++;
    if (m.flags.roleBased) roleCount++;
    if (m.flags.emptyEmail) emptyCount++;
    if (m.flags.missingLastName) missingLastNameCount++;
    if (m.flags.sanctioned) sanctionedCount++;
    if (m.flags.picklistViolations?.length > 0) picklistViolationCount++;
    if (m.nameSplit) namesSplit++;
    fieldsCorrected += m.modified.length;
    const orig = originalRows[i];
    const clean = cleanedRows[i];
    const changed = m.modified.length > 0 || Object.keys(clean).some(k => clean[k] !== orig[k]);
    if (changed) rowsModified++;
  });

  return { total: cleanedRows.length, rowsModified, personalCount, roleCount, emptyCount, namesSplit, fieldsCorrected, missingLastNameCount, sanctionedCount, picklistViolationCount };
}

function rowsToCsv(headers, rows) {
  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => `"${(row[h] || "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
}

function FilterToggle({ label, checked, onChange, color }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, color: T.text }}>
      <span style={{
        width: 40, height: 22, borderRadius: 11, background: checked ? (color || T.orange) : T.cardBorder,
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
        }} />
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
      {label}
    </label>
  );
}

function NormalizePanel({ onProceedToUpload, settings }) {
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState(null);
  const [removePersonal, setRemovePersonal] = useState(false);
  const [removeRoleBased, setRemoveRoleBased] = useState(false)
  const [removeSanctioned, setRemoveSanctioned] = useState(true);;
  const [removeEmptyEmail, setRemoveEmptyEmail] = useState(true);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFilename(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCsvFile(ev.target.result);
      const result = runCleanEngine(headers, rows, settings?.sanctionedCountries || [], settings?.picklistRules || []);
      setParsed(result);
    };
    reader.readAsText(f);
  };

  if (!parsed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Normalize</h2>
          <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>Clean and standardize your CSV before upload</p>
        </div>
        <div style={{ ...card, borderTop: `3px solid ${T.teal}` }}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.teal }}>Upload CSV</p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: T.muted }}>First row must be column headers. Cleaning runs automatically on upload.</p>
          <input type="file" accept=".csv" onChange={handleFile} style={{ fontSize: 14, color: T.text }} />
        </div>
      </div>
    );
  }

  const { headers, rows: cleanedRows, originalRows, meta } = parsed;
  const summary = computeSummary(originalRows, cleanedRows, meta);

  const filteredIndices = cleanedRows.map((_, i) => i).filter(i => {
    const f = meta[i].flags;
    if (removePersonal && f.personal) return false;
    if (removeRoleBased && f.roleBased) return false;
    if (removeEmptyEmail && f.emptyEmail) return false;
    if (removeSanctioned && f.sanctioned) return false;
    return true;
  });

  const filteredRows = filteredIndices.map(i => cleanedRows[i]);
  const filteredMeta = filteredIndices.map(i => meta[i]);
  const filteredOriginal = filteredIndices.map(i => originalRows[i]);

  const downloadCsv = () => {
    const csv = rowsToCsv(headers, filteredRows);
    const base = filename.replace(/\.csv$/i, "") || "export";
    const outName = `${base}_normalized.csv`;
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = outName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const statBadge = (label, count, color) => count > 0 ? (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>
      {label}: {count}
    </span>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Normalize</h2>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>
          {filename} · {summary.total.toLocaleString()} rows cleaned
        </p>
      </div>

      <div style={{ ...card, borderTop: `3px solid ${T.purple}` }}>
        <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 15, color: T.purple }}>Summary</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
          <Metric label="Total rows" value={summary.total} color={T.purple} />
          <Metric label="Rows modified" value={summary.rowsModified} color={T.teal} />
          <Metric label="Fields corrected" value={summary.fieldsCorrected} color={T.neon} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {statBadge("Personal emails", summary.personalCount, T.orange)}
          {statBadge("Role-based emails", summary.roleCount, T.yellow)}
          {statBadge("Empty emails", summary.emptyCount, T.danger)}
          {statBadge("Names split", summary.namesSplit, T.teal)}
          {statBadge("Missing last name", summary.missingLastNameCount, T.pink)}
          {statBadge("Sanctioned countries", summary.sanctionedCount, T.danger)}
          {statBadge("Picklist violations", summary.picklistViolationCount, T.coral)}
        </div>
      </div>

      <div style={card}>
        <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 15, color: T.text }}>Export filters</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FilterToggle label="Remove rows with personal emails" checked={removePersonal} onChange={setRemovePersonal} color={T.orange} />
          <FilterToggle label="Remove rows with role-based emails" checked={removeRoleBased} onChange={setRemoveRoleBased} color={T.yellow} />
          <FilterToggle label="Remove rows with empty emails" checked={removeEmptyEmail} onChange={setRemoveEmptyEmail} color={T.danger} />
          {summary.sanctionedCount > 0 && <FilterToggle label={`Remove sanctioned country records (${summary.sanctionedCount})`} checked={removeSanctioned} onChange={setRemoveSanctioned} color={T.danger} />}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: T.muted }}>
          Showing {filteredRows.length.toLocaleString()} of {summary.total.toLocaleString()} rows after filters
        </p>
      </div>

      <div style={card}>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted }}>
          {filteredRows.length.toLocaleString()} rows · modified cells highlighted
        </p>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400, borderRadius: 10, border: `1px solid ${T.cardBorder}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", top: 0, background: T.card, padding: "8px 10px", textAlign: "left", color: T.muted, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${T.cardBorder}` }}>Flags</th>
                {headers.map(h => (
                  <th key={h} style={{ position: "sticky", top: 0, background: T.card, padding: "8px 10px", textAlign: "left", color: T.muted, fontSize: 11, textTransform: "uppercase", borderBottom: `1px solid ${T.cardBorder}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, ri) => {
                const m = filteredMeta[ri];
                const orig = filteredOriginal[ri];
                return (
                  <tr key={ri}>
                    <td style={{ padding: "6px 10px", borderBottom: `1px solid ${T.cardBorder}33`, verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {m.flags.personal && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: `${T.orange}22`, color: T.orange, fontWeight: 600 }}>Personal</span>}
                        {m.flags.roleBased && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: `${T.yellow}22`, color: T.yellow, fontWeight: 600 }}>Role-Based</span>}
                        {m.flags.emptyEmail && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: `${T.danger}22`, color: T.danger, fontWeight: 600 }}>Empty Email</span>}
                        {m.flags.missingLastName && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: `${T.pink}22`, color: T.pink, fontWeight: 600 }}>No Last Name</span>}
                        {m.flags.sanctioned && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: `${T.danger}33`, color: T.danger, fontWeight: 600 }}>Sanctioned</span>}
                        {m.flags.picklistViolations?.map((v, vi) => (
                          <span key={vi} title={`Allowed: ${v.allowed.join(", ")}`} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8, background: `${T.coral}22`, color: T.coral, fontWeight: 600 }}>
                            {v.field}: "{v.value}"
                          </span>
                        ))}
                      </div>
                    </td>
                    {headers.map(h => {
                      const modified = m.modified.includes(h) || (orig[h] || "") !== (row[h] || "");
                      return (
                        <td key={h} style={{
                          padding: "6px 10px", borderBottom: `1px solid ${T.cardBorder}33`, color: T.text,
                          background: modified ? `${T.teal}26` : "transparent", whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis",
                        }}>{row[h] || ""}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={downloadCsv} style={ghost}>Download cleaned CSV</button>
        <button
          onClick={() => onProceedToUpload({ headers, rows: filteredRows, filename: filename.replace(/\.csv$/i, "") + "_normalized.csv" })}
          style={btn(T.orange)}
        >
          Proceed to Upload →
        </button>
        <button onClick={() => { setParsed(null); setFilename(""); }} style={{ ...ghost, marginLeft: "auto" }}>Upload different file</button>
      </div>
    </div>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "⬡", label: "Dashboard" },
  { id: "upload", icon: "↑", label: "Upload" },
  { id: "normalize", icon: "✦", label: "Normalize" },
  { id: "queue", icon: "▤", label: "Queue" },
  { id: "logs", icon: "≡", label: "Logs" },
  { id: "errors", icon: "⚠", label: "Errors" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [preloadedCsv, setPreloadedCsv] = useState(null);
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...ls.get("mkto_settings", {}) }));
  const [logs, setLogs] = useState(() => ls.get("mkto_logs", []));
  const [errors, setErrors] = useState(() => ls.get("mkto_errors", []));
  const [queue, setQueue] = useState([]);
  const abortMap = useRef({});

  const addLog = useCallback((e) => setLogs(prev => {
    const u = [e, ...prev.filter(l => l.id !== e.id)];
    ls.set("mkto_logs", u.slice(0, 200));
    return u;
  }), []);

  const addErrors = useCallback((errs) => setErrors(prev => {
    const u = [...errs, ...prev];
    ls.set("mkto_errors", u.slice(0, 500));
    return u;
  }), []);

  const updateJob = useCallback((id, patch) => {
    setQueue(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  const runUpload = useCallback(async (jobId, config) => {
    const { creds, programId, programName, memberStatus, mappedRows, filename, batchSize, intervalSec, retryAttempts, retryDelaySec, sanctionedCountries = [] } = config;
    const startedAt = new Date().toISOString();

    // Filter out sanctioned country records before batching
    const sanctionedSet = new Set(sanctionedCountries.map(c => c.toLowerCase().trim()));
    const safeRows = sanctionedSet.size > 0
      ? mappedRows.filter(r => {
          const country = (r.country || r.billingCountry || "").toLowerCase().trim();
          return !country || !sanctionedSet.has(country);
        })
      : mappedRows;
    const sanctionedDropped = mappedRows.length - safeRows.length;

    const batches = [];
    for (let i = 0; i < safeRows.length; i += batchSize) batches.push(safeRows.slice(i, i + batchSize));
    updateJob(jobId, { batchesTotal: batches.length, sanctionedDropped });

    let processed = 0;
    let hasError = false;
    const newErrors = [];

    for (let i = 0; i < batches.length; i++) {
      if (abortMap.current[jobId]) { hasError = true; break; }
      updateJob(jobId, { currentBatch: i + 1 });

      let importId = null;
      let batchError = null;

      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          const headers = Object.keys(batches[i][0]);
          const csvContent = [
            headers.join(","),
            ...batches[i].map(r => headers.map(h => `"${(r[h] || "").replace(/"/g, '""')}"`).join(",")),
          ].join("\n");
          const data = await apiPost("/api/import", { ...creds, programId, memberStatus, csvContent, filename: `batch_${i + 1}.csv` });
          importId = data.importId;
          batchError = null;
          break;
        } catch (err) {
          batchError = err.message;
          if (attempt < retryAttempts) await sleep(retryDelaySec * 1000 * (attempt + 1));
        }
      }

      if (batchError || !importId) {
        hasError = true;
        newErrors.push({ id: `err_${Date.now()}_${i}`, uploadId: jobId, listName: filename, batchIndex: i + 1, errorCode: "BATCH_ERROR", leadId: "", email: "", message: batchError || "No importId returned", timestamp: new Date().toISOString() });
        updateJob(jobId, { batchesDone: i + 1 });
        if (i < batches.length - 1) await sleep(intervalSec * 1000);
        continue;
      }

      let pollResult = { ok: false, imported: 0, failed: 0, timeout: true };
      for (let p = 0; p < 30; p++) {
        await sleep(10000);
        try {
          const statusData = await apiPost("/api/status", { ...creds, programId, importId });
          if (statusData.status === "Complete") { pollResult = { ok: true, imported: statusData.numImported || 0, failed: statusData.numFailed || 0, timeout: false }; break; }
          if (statusData.status === "Failed") { pollResult = { ok: false, imported: 0, failed: 0, timeout: false }; break; }
        } catch { /* keep polling */ }
      }

      processed += pollResult.imported;
      if (!pollResult.ok || pollResult.failed > 0) {
        hasError = true;
        if (pollResult.timeout) {
          newErrors.push({ id: `err_${Date.now()}_${i}`, uploadId: jobId, listName: filename, batchIndex: i + 1, errorCode: "TIMEOUT", leadId: "", email: "", message: "Job timed out after 5 minutes", timestamp: new Date().toISOString() });
        } else if (pollResult.failed > 0) {
          try {
            const failData = await apiPost("/api/failures", { ...creds, importId });
            if (failData.failures?.length > 0) {
              failData.failures.forEach((f, fi) => newErrors.push({ id: `err_${Date.now()}_${i}_${fi}`, uploadId: jobId, listName: filename, batchIndex: i + 1, errorCode: "LEAD_IMPORT_FAILED", leadId: f.leadId, email: f.email, message: f.reason, timestamp: new Date().toISOString() }));
            } else {
              newErrors.push({ id: `err_${Date.now()}_${i}`, uploadId: jobId, listName: filename, batchIndex: i + 1, errorCode: "PARTIAL_FAILURE", leadId: "", email: "", message: `${pollResult.failed} records failed in batch ${i + 1}`, timestamp: new Date().toISOString() });
            }
          } catch {
            newErrors.push({ id: `err_${Date.now()}_${i}`, uploadId: jobId, listName: filename, batchIndex: i + 1, errorCode: "PARTIAL_FAILURE", leadId: "", email: "", message: `${pollResult.failed} records failed in batch ${i + 1}`, timestamp: new Date().toISOString() });
          }
        }
      }

      updateJob(jobId, { batchesDone: i + 1, recordsImported: processed });
      if (i < batches.length - 1) await sleep(intervalSec * 1000);
    }

    const finalStatus = abortMap.current[jobId] ? "failed" : hasError ? (processed > 0 ? "partial" : "failed") : "complete";
    const finishedAt = new Date().toISOString();
    updateJob(jobId, { status: finalStatus, finishedAt, recordsImported: processed });
    delete abortMap.current[jobId];

    addLog({ id: jobId, listName: filename, programName, programId, memberStatus, totalRecords: mappedRows.length, processedRecords: processed, batchesTotal: batches.length, batchesDone: batches.length, status: finalStatus, startedAt, finishedAt });
    if (newErrors.length) addErrors(newErrors);
  }, [updateJob, addLog, addErrors]);

  const submitUpload = useCallback((config) => {
    const jobId = `job_${Date.now()}`;
    const batchesTotal = Math.ceil(config.mappedRows.length / config.batchSize);
    abortMap.current[jobId] = false;
    setQueue(prev => [{
      id: jobId,
      listName: config.filename,
      programName: config.programName,
      memberStatus: config.memberStatus,
      totalRecords: config.mappedRows.length,
      batchesTotal,
      batchesDone: 0,
      recordsImported: 0,
      currentBatch: 0,
      status: "uploading",
      startedAt: new Date().toISOString(),
      finishedAt: null,
    }, ...prev]);
    setTab("queue");
    runUpload(jobId, config);
  }, [runUpload]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: T.text }}>
      <nav style={{ width: 220, background: T.sidebar, borderRight: `1px solid ${T.cardBorder}`, padding: "1.5rem 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.orange}, ${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬆</div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.text }}>Luna</p>
              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>List Upload Manager</p>
            </div>
          </div>
        </div>
        {NAV.map(item => {
          const isQueue = item.id === "queue";
          const activeJobs = isQueue ? queue.filter(j => j.status === "uploading").length : 0;
          return (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 1.25rem", fontSize: 14, border: "none", background: tab === item.id ? `${T.orange}18` : "transparent", color: tab === item.id ? T.orange : T.muted, borderLeft: tab === item.id ? `3px solid ${T.orange}` : "3px solid transparent", cursor: "pointer", textAlign: "left", width: "100%", fontWeight: tab === item.id ? 600 : 400 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
              {activeJobs > 0 && (
                <span style={{ marginLeft: "auto", background: T.teal, color: "#0f0f13", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{activeJobs}</span>
              )}
            </button>
          );
        })}
      </nav>
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto", maxWidth: 900 }}>
        {tab === "dashboard" && <Dashboard logs={logs} errors={errors} />}
        {tab === "upload" && <UploadPanel settings={settings} onSubmit={submitUpload} preloadedCsv={preloadedCsv} onPreloadConsumed={() => setPreloadedCsv(null)} />}
        {tab === "normalize" && <NormalizePanel settings={settings} onProceedToUpload={(cleanedData) => { setPreloadedCsv(cleanedData); setTab("upload"); }} />}
        {tab === "queue" && <UploadQueue jobs={queue} abortMap={abortMap} onClearDone={() => setQueue(prev => prev.filter(j => j.status === "uploading"))} />}
        {tab === "logs" && <UploadLogs logs={logs} onClear={() => { setLogs([]); ls.set("mkto_logs", []); }} />}
        {tab === "errors" && <ErrorLogs errors={errors} onClear={() => { setErrors([]); ls.set("mkto_errors", []); }} />}
        {tab === "settings" && <Settings settings={settings} onChange={setSettings} />}
      </main>
    </div>
  );
}
