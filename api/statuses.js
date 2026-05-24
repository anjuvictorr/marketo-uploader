import { getToken, normalizeUrls, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret, channel } = req.body;
    if (!channel) return res.status(400).json({ error: "channel is required" });
    const token = await getToken(restUrl, clientId, clientSecret);
    const { restBase } = normalizeUrls(restUrl);
    const response = await fetch(
      `${restBase}/asset/v1/channel/byName.json?name=${encodeURIComponent(channel)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || "Failed to fetch channel statuses");
    const statuses = (data.result?.[0]?.progressionStatuses || []).map(s => s.name);
    res.json({ statuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
