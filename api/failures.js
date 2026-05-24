import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret, importId } = req.body;
    if (!importId) return res.status(400).json({ error: "importId is required" });
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    const bulkBase = restBase.replace(/\/rest$/i, "");
    const response = await fetch(
      `${bulkBase}/bulk/v1/program/members/import/${importId}/failures.json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const text = await response.text();
    // Parse CSV — first row is headers, remaining rows are failed leads
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return res.json({ failures: [] });
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const failures = lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const row = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ""; });
      return {
        leadId: row["id"] || row["lead id"] || row["leadid"] || "",
        email: row["email"] || "",
        reason: row["import failure reason"] || row["reason"] || row["error"] || "Unknown error",
      };
    });
    res.json({ failures });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
