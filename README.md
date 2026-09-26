# BERLIN X PANEL — GitHub + Render + Admin Edition

This repository is intentionally split for future maintenance. The existing BERLIN X PANEL dashboard is preserved as ordered assets, while the new admin/app-registration system is isolated from it.

## Pages
- `/` — existing BERLIN X PANEL
- `/submit.html` — user app registration + APK upload
- `/admin` — protected admin console
- `/health` — health endpoint

## Structure
```text
index.html
submit.html
admin.html
server.py
css/
js/
assets/
docs/
tools/
verify_deploy.py
render.yaml
.env.example
```

## Run locally
Python 3.11+:

```bash
python server.py
```

Set credentials first:

PowerShell:
```powershell
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD="use-a-long-random-password"
python server.py
```

Linux/macOS:
```bash
export ADMIN_USER=admin
export ADMIN_PASSWORD='use-a-long-random-password'
python server.py
```

Open:
- `http://127.0.0.1:10000/`
- `http://127.0.0.1:10000/submit.html`
- `http://127.0.0.1:10000/admin`

## GitHub
Extract the ZIP and upload **all contents of this folder** to the repository root. Do not upload `.env`, `data/`, or generated APKs.

## Render
Create a Python Web Service from this GitHub repository.

Start command:
```text
python server.py
```

Set these environment variables in Render:
```text
ADMIN_USER=your-admin-name
ADMIN_PASSWORD=your-strong-password
MAX_APK_MB=150
DATA_DIR=/var/data
```

For durable APK/SQLite storage, attach a persistent disk mounted at `/var/data`. Without persistent storage, Render's normal filesystem is not a durable database/file store.


## Bulk Firebase health checker
The admin console includes a persistent background **Bulk Firebase** job queue. The uploader accepts either plain URL lines or CSV-style one-to-one records such as:

```text
URL,SECRET_KEY
https://project-a-default-rtdb.firebaseio.com,key-a
https://project-b-default-rtdb.firebaseio.com,key-b
```

For safety, the browser extracts only the Firebase URLs and sends those URLs to the background worker; the second column is not stored or used for authentication. The server stores the job and continues processing after the browser closes. Job state and per-URL results are stored in SQLite under `DATA_DIR`, and unfinished jobs are recovered as `pending` after a server restart.

The worker performs HTTPS reachability checks only and accepts official Firebase Realtime Database host families (`*.firebaseio.com` and `*.firebasedatabase.app`). It does **not** accept, store, or try passwords, API secrets, database tokens, or authentication credentials.

Optional tuning variables:
```text
BULK_MAX_URLS=2000
BULK_MAX_BYTES=300000
BULK_TIMEOUT=8
FIREBASE_ALLOWED_HOST_SUFFIXES=example.internal
```

## Admin data boundary
The system stores only fields and APK files that a user explicitly submits. A Firebase project URL/config does not grant permission to read that project's private database, Auth users, tokens, service-account keys, or other private data.

The main panel also records connection events in the protected admin console. The log contains the Firebase database URL, connection type, timestamp, and non-reversible authentication-key fingerprint/presence flag. The raw authentication key/secret is never sent to or stored by the panel server.

## Verification
```bash
python verify_deploy.py
```

## UI/UX system
`assets/design-tokens.json`, `assets/design-tokens.css`, and `docs/design-system.md` document the three-layer token approach and UX checks derived from the uploaded UI/UX Pro Max skill. They are kept separate so the existing dashboard can be refactored incrementally without breaking its runtime.

## Production note
For a larger multi-instance deployment, use Postgres for metadata and object storage for APKs instead of local SQLite/filesystem.


## Public Bulk Firebase page
The main Firebase connection dialog opens `/bulk`, a public, mobile-first bulk URL health checker. It accepts plain URL lines or `URL,SECRET_KEY` CSV-style input; only the URL column is processed by the public health worker. No credential material is stored or used by this public checker. Jobs are server-side and persist in SQLite under DATA_DIR.

### Terminal API request logging

The Python server prints request activity to the terminal. API traffic is shown with the HTTP method, route, status code, and for browser-originated Firebase requests, the measured duration. Authentication query strings, request bodies, headers, and secrets are intentionally not printed.

Examples:
```text
[API] GET    /api/public-bulk/jobs -> 200
[API] POST   /api/public-bulk/jobs -> 201
[API] GET    https://project.firebaseio.com/devices.json -> 200 42ms [firebase-client] client request
[API] DELETE /api/apps/3/delete -> 200
```

Set `API_TRACE=0` to disable the extra API trace output.


## Strict bulk Firebase health classification

The public bulk health worker performs a GET request to each allowlisted Firebase Realtime Database URL without using or storing credential material.

- HTTP 200 + non-empty valid JSON => `active`
- HTTP 200 + null/empty/empty JSON/invalid JSON => `invalid_no_data`
- HTTP 4xx/5xx (including 401, 403, 404, 423) => `inactive`
- DNS/connection/timeout errors => `inactive`

The response body is inspected only to classify the health result; it is not persisted.


## Bulk large-response handling

The public bulk health checker uses a bounded Firebase Realtime Database probe (`orderBy=$key&limitToFirst=1`) instead of requesting the complete node. This prevents very large RTDB payloads from being loaded into memory during a health check. A 64 KiB hard ceiling remains as a defensive fallback for endpoints that ignore the limiting query. Response bodies are never written to the terminal log.

## Telegram control companion

`telegram_bot.py` is an optional standard-library-only companion that starts automatically when `server.py` starts. Configure `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` as environment variables. On startup it sends an online notification to the configured chat. It accepts `.txt` uploads from that authorized chat and queues them through the existing public bulk endpoint, and provides `/status`, `/jobs`, `/report`, and `/help` commands. Every 30 minutes it sends a non-sensitive job summary. It does not send Firebase response bodies, credentials, or URL lists to Telegram.

Never hard-code a Telegram bot token in source control. If a token was exposed, revoke/regenerate it before deployment.
