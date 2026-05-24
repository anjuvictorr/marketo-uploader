import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret } = req.body;
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    // Paginate through all programs — Marketo caps at 200 per call
    const all = [];
    let offset = 0;
    while (true) {
      const response = await fetch(
        `${restBase}/asset/v1/programs.json?maxReturn=200&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.errors?.[0]?.message || "Failed to fetch programs");
      const batch = data.result || [];
      all.push(...batch);
      if (batch.length < 200) break;
      offset += 200;
    }
    res.json({ programs: all.map(p => ({ id: p.id, name: p.name, channel: p.channel })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
