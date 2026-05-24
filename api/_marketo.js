import fetch from "node-fetch";

export function normalizeUrls(restUrl) {
  const base = restUrl.trim().replace(/\/+$/, "");
  const identityBase = base.replace(/\/rest$/i, "/identity");
  return { restBase: base, identityBase };
}

export async function getToken(restUrl, clientId, clientSecret) {
  if (!restUrl || !clientId || !clientSecret) throw new Error("Missing credentials");
  const { identityBase } = normalizeUrls(restUrl);
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${identityBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || "No access token");
  return data.access_token;
}

export function corsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
