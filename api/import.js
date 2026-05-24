import FormData from "form-data";
import fetch from "node-fetch";
import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export const config = { api: { bodyParser: { sizeLimit: "11mb" } } };

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret, programId, memberStatus, csvContent, filename } = req.body;
    if (!csvContent) return res.status(400).json({ error: "csvContent is required" });
    if (!programId) return res.status(400).json({ error: "programId is required" });
    if (!memberStatus) return res.status(400).json({ error: "memberStatus is required" });
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    const bulkBase = restBase.replace(/\/rest$/i, "");
    const buf = Buffer.from(csvContent, "utf8");
    const form = new FormData();
    form.append("format", "csv");
    form.append("programMemberStatus", memberStatus);
    form.append("file", buf, { filename: filename || "batch.csv", contentType: "text/csv" });
    const response = await fetch(`${bulkBase}/bulk/v1/program/${programId}/members/import.json`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
      body: form,
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Marketo returned non-JSON: ${text.slice(0, 200)}`); }
    if (!data.success) throw new Error(data.errors?.[0]?.message || "Import failed");
    const importId = data.result?.[0]?.importId;
    if (!importId) throw new Error("Marketo accepted the import but returned no importId");
    res.json({ importId });
  } catch (err) {
    console.error("import error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
