import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret } = req.body;
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    const response = await fetch(`${restBase}/v1/leads/describe.json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || "Failed to fetch fields");
    const fields = data.result
      .filter(f => f.rest?.name)
      .map(f => ({ rest: f.rest.name, display: f.displayName || f.rest.name }));
    res.json({ fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
