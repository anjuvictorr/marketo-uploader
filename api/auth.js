import { getToken, corsHeaders } from "./_marketo.js";

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { restUrl, clientId, clientSecret } = req.body;
    if (!restUrl || !clientId || !clientSecret)
      return res.status(400).json({ error: "restUrl, clientId and clientSecret are required" });
    await getToken(restUrl, clientId, clientSecret);
    res.json({ ok: true, message: "Connected successfully" });
  } catch (err) {
    res.status(401).json({ ok: false, error: err.message });
  }
}
