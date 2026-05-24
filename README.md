# Marketo Batch List Uploader

A tool that solves the Marketo API concurrency problem by batching list uploads, mapping CSV fields to Marketo fields, and giving you clear logs of what succeeded and what failed.

## The problem this solves

Marketo has a concurrency limit of 100 requests per 20 seconds. When you upload large lists from multiple integrations (ZoomInfo, Zapier, Accelevents) simultaneously, records get silently dropped. This tool batches uploads in controlled waves so you never flood the API.

## Architecture

```
Browser (Lovable) → Backend (Vercel) → Marketo API
```

The backend handles all Marketo API calls server-side, which is required because Marketo blocks direct browser requests (CORS policy).

## Repo structure

```
marketo-uploader/
  api/                  ← Vercel serverless functions (backend)
    _marketo.js         ← shared auth + URL helpers
    auth.js             ← test connection
    programs.js         ← fetch Marketo programs
    fields.js           ← fetch Marketo lead fields
    import.js           ← bulk import a CSV batch
    status.js           ← poll import job status
    package.json
  src/
    App.jsx             ← React frontend
  vercel.json           ← Vercel config
  README.md
```

## Deploy in 5 minutes

### 1. Fork this repo on GitHub

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your forked GitHub repo
3. Leave all settings as default → click Deploy
4. Copy your Vercel URL (e.g. `https://marketo-uploader.vercel.app`)

### 3. Update the frontend API URL

In `src/App.jsx`, find this line:

```js
const API_URL = "https://your-vercel-app.vercel.app";
```

Replace with your actual Vercel URL.

### 4. Deploy the frontend to Lovable

1. Go to [lovable.dev](https://lovable.dev)
2. Create a new project and paste the updated `App.jsx`

### 5. Configure your Marketo credentials

In the app → Settings, enter:

| Field | Where to find it |
|---|---|
| Client ID | Admin → Integration → LaunchPoint → View Details |
| Client Secret | Admin → Integration → LaunchPoint → View Details |
| Munchkin ID | Admin → Integration → Munchkin |
| REST endpoint URL | Admin → Integration → Web Services → REST API → Endpoint |

Credentials are stored in your browser's localStorage only. Never sent to anyone except Marketo.

## How it works

1. Select a Marketo program (searchable dropdown, fetched live from your instance)
2. Upload your CSV file
3. Map CSV columns to Marketo fields (auto-matched where possible, flags unmapped ones)
4. Upload — records split into batches of 300, sent every 20 seconds
5. Logs show exactly what was processed, what failed, and why

## Built with

- React (frontend, hosted on Lovable)
- Vercel Serverless Functions (backend, free tier)
- Marketo Bulk Import API
