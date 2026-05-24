import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret } = req.body;
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    const response = await fetch(`${restBase}/asset/v1/programs.json?maxReturn=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || "Failed to fetch programs");
    res.json({ programs: data.result.map(p => ({ id: p.id, name: p.name })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
