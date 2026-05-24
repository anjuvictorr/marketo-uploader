import { useState, useRef, useCallback, useEffect } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = "https://marketo-uploader.vercel.app";

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
  get: (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const DEFAULT_SETTINGS = {
  clientId: "", clientSecret: "", munchkinId: "", restUrl: "",
  batchSize: 300, intervalSec: 20, retryAttempts: 3, retryDelaySec: 30,
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
    success: [T.neon, "#0f2a0f"], failed: [T.danger, "#2a0f0f"],
    partial: [T.yellow, "#2a250f"], running: [T.teal, "#0f2a2a"], pending: [T.muted, "#1e1e2a"],
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

function autoMap(header, fields) {
  const h = header.toLowerCase().replace(/[\s_-]/g, "");
  return fields.find(f =>
    f.rest.toLowerCase().replace(/[\s_-]/g, "") === h ||
    f.display.toLowerCase().replace(/[\s_-]/g, "") === h
  )?.rest || "";
}

function FieldMapping({ csvHeaders, marketoFields, mapping, onChange }) {
  // Auto-map on mount only
  useEffect(() => {
    const initial = {};
    csvHeaders.forEach(h => { initial[h] = autoMap(h, marketoFields); });
    onChange(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount

  const unmapped = csvHeaders.filter(h => !mapping[h]);

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: "8px 12px", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>CSV column</div>
        <div />
        <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Marketo field</div>
        {csvHeaders.map(h => {
          const mapped = mapping[h] || "";
          const isUnmapped = !mapped;
          return [
            <div key={`csv-${h}`} style={{ background: "#0f0f13", border: `1px solid ${isUnmapped ? T.coral + "66" : T.cardBorder}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: isUnmapped ? T.coral : T.text }}>{h}</div>,
            <div key={`arr-${h}`} style={{ textAlign: "center", color: mapped ? T.neon : T.coral, fontSize: 16 }}>{mapped ? "→" : "⚠"}</div>,
            <select key={`sel-${h}`} value={mapped} onChange={e => onChange({ ...mapping, [h]: e.target.value })}
              style={{ ...inp, border: `1px solid ${isUnmapped ? T.coral + "66" : T.cardBorder}`, color: mapped ? T.text : T.muted }}>
              <option value="">— skip this field —</option>
              {marketoFields.map(f => <option key={f.rest} value={f.rest}>{f.display} ({f.rest})</option>)}
            </select>,
          ];
        })}
      </div>
      {unmapped.length > 0 && (
        <div style={{ background: "#2a1509", border: `1px solid ${T.coral}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.coral }}>
          ⚠ {unmapped.length} column{unmapped.length > 1 ? "s" : ""} not mapped — they will be skipped. Map them above or leave to skip.
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ logs, errors }) {
  const total = logs.length;
  const success = logs.filter(l => l.status === "success").length;
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

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
const MEMBER_STATUSES = ["Member", "Attended", "Registered", "On List", "Invited", "Waitlisted", "No Show"];

function UploadPanel({ settings, onLogEntry, onErrorEntry }) {
  const [step, setStep] = useState(1);
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [memberStatus, setMemberStatus] = useState("Member");
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [marketoFields, setMarketoFields] = useState(COMMON_FIELDS);
  const [mapping, setMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const abortRef = useRef(false);

  const getCreds = useCallback(() => {
    const { restUrl, clientId, clientSecret } = settings;
    if (!restUrl || !clientId || !clientSecret) throw new Error("Credentials not configured. Go to Settings.");
    return { restUrl, clientId, clientSecret };
  }, [settings]);

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

  const startUpload = async () => {
    setUploadError("");
    const { batchSize, intervalSec, retryAttempts, retryDelaySec } = settings;
    abortRef.current = false;
    setUploading(true);

    const logId = `log_${Date.now()}`;
    const mappedRows = csvData.rows.map(remapRow).filter(r => Object.keys(r).length > 0);

    if (mappedRows.length === 0) {
      setUploadError("No mapped fields — please map at least one CSV column to a Marketo field.");
      setUploading(false);
      return;
    }

    const batches = [];
    for (let i = 0; i < mappedRows.length; i += batchSize) {
      batches.push(mappedRows.slice(i, i + batchSize));
    }

    const programName = programs.find(p => String(p.id) === String(selectedProgram))?.name || selectedProgram;
    const logEntry = {
      id: logId, listName: file.name, programName, programId: selectedProgram,
      memberStatus, totalRecords: mappedRows.length, processedRecords: 0,
      batchesTotal: batches.length, batchesDone: 0, status: "running",
      startedAt: new Date().toISOString(), finishedAt: null,
    };

    setProgress({ total: batches.length, done: 0, records: 0 });
    let processed = 0;
    let hasError = false;
    const newErrors = [];
    const creds = getCreds();

    for (let i = 0; i < batches.length; i++) {
      if (abortRef.current) { hasError = true; break; }

      let importId = null;
      let batchError = null;

      // Upload batch with retry
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          const headers = Object.keys(batches[i][0]);
          const csvContent = [
            headers.join(","),
            ...batches[i].map(r => headers.map(h => `"${(r[h] || "").replace(/"/g, '""')}"`).join(",")),
          ].join("\n");

          const data = await apiPost("/api/import", {
            ...creds,
            programId: selectedProgram,
            memberStatus,
            csvContent,
            filename: `batch_${i + 1}.csv`,
          });

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
        newErrors.push({ id: `err_${Date.now()}_${i}`, uploadId: logId, listName: file.name, batchIndex: i + 1, errorCode: "BATCH_ERROR", message: batchError || "No importId returned", timestamp: new Date().toISOString() });
        setProgress({ total: batches.length, done: i + 1, records: processed });
        if (i < batches.length - 1) await sleep(intervalSec * 1000);
        continue;
      }

      // Poll for job completion
      let pollResult = { ok: false, imported: 0, failed: 0, timeout: true };
      for (let p = 0; p < 30; p++) {
        await sleep(10000);
        try {
          const statusData = await apiPost("/api/status", { ...creds, programId: selectedProgram, importId });
          if (statusData.status === "Complete") {
            pollResult = { ok: true, imported: statusData.numImported || 0, failed: statusData.numFailed || 0, timeout: false };
            break;
          }
          if (statusData.status === "Failed") {
            pollResult = { ok: false, imported: 0, failed: 0, timeout: false };
            break;
          }
        } catch {
          // keep polling
        }
      }

      processed += pollResult.imported;
      if (!pollResult.ok || pollResult.failed > 0) {
        hasError = true;
        newErrors.push({
          id: `err_${Date.now()}_${i}`, uploadId: logId, listName: file.name, batchIndex: i + 1,
          errorCode: pollResult.timeout ? "TIMEOUT" : "PARTIAL_FAILURE",
          message: pollResult.timeout ? "Job timed out after 5 minutes" : `${pollResult.failed} records failed in batch ${i + 1}`,
          timestamp: new Date().toISOString(),
        });
      }

      setProgress({ total: batches.length, done: i + 1, records: processed });
      if (i < batches.length - 1) await sleep(intervalSec * 1000);
    }

    logEntry.processedRecords = processed;
    logEntry.batchesDone = batches.length;
    logEntry.status = abortRef.current ? "failed" : hasError ? (processed > 0 ? "partial" : "failed") : "success";
    logEntry.finishedAt = new Date().toISOString();
    onLogEntry(logEntry);
    if (newErrors.length) onErrorEntry(newErrors);
    setUploading(false);
    setProgress(null);
  };

  const reset = () => { setStep(1); setFile(null); setCsvData(null); setMapping({}); setSelectedProgram(""); setProgress(null); setUploadError(""); };
  const programSelected = programs.find(p => String(p.id) === String(selectedProgram));
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text }}>Upload list</h2>
        <p style={{ margin: "4px 0 0", color: T.muted, fontSize: 14 }}>Map CSV columns to Marketo fields, then queue batches for import</p>
      </div>

      {/* STEP INDICATORS */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {["Program", "CSV file", "Field mapping", "Upload"].map((s, i) => {
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
            <SearchDropdown options={programs} value={selectedProgram} onChange={setSelectedProgram} placeholder="Search and select a program..." disabled={programs.length === 0} />
          </div>
          <div>
            <label style={lbl}>Member status</label>
            <select value={memberStatus} onChange={e => setMemberStatus(e.target.value)} style={inp}>
              {MEMBER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
          <FieldMapping csvHeaders={csvData.headers} marketoFields={marketoFields} mapping={mapping} onChange={setMapping} />
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStep(4)} style={btn(T.yellow)}>Confirm mapping → Review upload</button>
          </div>
        </div>
      )}

      {/* STEP 4 */}
      {step >= 4 && (
        <div style={card}>
          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 15, color: T.neon }}>Step 4 — Upload</p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16, fontSize: 13, color: T.muted }}>
            <span>Program: <strong style={{ color: T.text }}>{programSelected?.name}</strong></span>
            <span>Status: <strong style={{ color: T.text }}>{memberStatus}</strong></span>
            <span>Records: <strong style={{ color: T.text }}>{csvData.rows.length.toLocaleString()}</strong></span>
            <span>Batch size: <strong style={{ color: T.text }}>{settings.batchSize}</strong></span>
            <span>Mapped fields: <strong style={{ color: T.neon }}>{Object.values(mapping).filter(Boolean).length}</strong></span>
          </div>
          {uploadError && (
            <div style={{ marginBottom: 12, background: "#2a0f0f", border: `1px solid ${T.danger}33`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: T.danger }}>
              ✗ {uploadError}
            </div>
          )}
          {progress && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted, marginBottom: 6 }}>
                <span>Batch {progress.done} of {progress.total}</span>
                <span>{pct}% · {progress.records.toLocaleString()} records processed</span>
              </div>
              <div style={{ height: 8, background: "#1e1e2a", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${T.purple}, ${T.orange})`, borderRadius: 4, transition: "width 0.4s" }} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            {!uploading && <button onClick={startUpload} style={btn(T.neon)}>🚀 Start upload</button>}
            {uploading && <button onClick={() => { abortRef.current = true; }} style={btn(T.danger)}>Stop</button>}
            {!uploading && <button onClick={reset} style={ghost}>Start over</button>}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: T.danger }}>{e.errorCode}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.muted }}>{e.listName} · Batch {e.batchIndex}</p>
              </div>
              <span style={{ fontSize: 12, color: T.muted }}>{new Date(e.timestamp).toLocaleString()}</span>
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
      const data = await apiPost("/api/auth", { clientId, clientSecret, restUrl });
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
      <button onClick={save} style={{ ...btn(saved ? T.neon : T.orange), alignSelf: "flex-start", color: saved ? "#0f0f13" : "#fff" }}>
        {saved ? "✓ Saved" : "Save settings"}
      </button>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", icon: "⬡", label: "Dashboard" },
  { id: "upload", icon: "↑", label: "Upload" },
  { id: "logs", icon: "≡", label: "Logs" },
  { id: "errors", icon: "⚠", label: "Errors" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...ls.get("mkto_settings", {}) }));
  const [logs, setLogs] = useState(() => ls.get("mkto_logs", []));
  const [errors, setErrors] = useState(() => ls.get("mkto_errors", []));

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

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: T.text }}>
      <nav style={{ width: 220, background: T.sidebar, borderRight: `1px solid ${T.cardBorder}`, padding: "1.5rem 0", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: `1px solid ${T.cardBorder}`, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${T.orange}, ${T.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⬆</div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: T.text }}>List Upload</p>
              <p style={{ margin: 0, fontSize: 11, color: T.muted }}>Marketo manager</p>
            </div>
          </div>
        </div>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 1.25rem", fontSize: 14, border: "none", background: tab === item.id ? `${T.orange}18` : "transparent", color: tab === item.id ? T.orange : T.muted, borderLeft: tab === item.id ? `3px solid ${T.orange}` : "3px solid transparent", cursor: "pointer", textAlign: "left", width: "100%", fontWeight: tab === item.id ? 600 : 400 }}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto", maxWidth: 900 }}>
        {tab === "dashboard" && <Dashboard logs={logs} errors={errors} />}
        {tab === "upload" && <UploadPanel settings={settings} onLogEntry={addLog} onErrorEntry={addErrors} />}
        {tab === "logs" && <UploadLogs logs={logs} onClear={() => { setLogs([]); ls.set("mkto_logs", []); }} />}
        {tab === "errors" && <ErrorLogs errors={errors} onClear={() => { setErrors([]); ls.set("mkto_errors", []); }} />}
        {tab === "settings" && <Settings settings={settings} onChange={setSettings} />}
      </main>
    </div>
  );
}
