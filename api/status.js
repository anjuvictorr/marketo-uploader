import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret, programId, importId } = req.body;
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    const bulkBase = restBase.replace(/\/rest$/i, "");
    const response = await fetch(
      `${bulkBase}/bulk/v1/program/${programId}/members/import/${importId}/status.json`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const text = await response.text();
    console.log("Marketo status raw response:", text.slice(0, 500));
    let data;
    try { data = JSON.parse(text); } catch { throw new Error(`Non-JSON from Marketo: ${text.slice(0, 200)}`); }
    if (!data.success) throw new Error(data.errors?.[0]?.message || `Status check failed: ${text.slice(0, 200)}`);
    const job = data.result?.[0];
    console.log("Marketo status job:", JSON.stringify(job));
    res.json({ status: job?.status, numImported: job?.numImported || 0, numFailed: job?.numFailed || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
