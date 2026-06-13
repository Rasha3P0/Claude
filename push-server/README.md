# Ground Control — companion push server

Ground Control is a static PWA. **Background push when the app is closed cannot
be done by a static site** — the Web Push spec requires a server that holds the
VAPID *private* key and POSTs to each browser's push endpoint on schedule. This
small service is that server, and the only non-static piece of the project.

Without it, the PWA still works: it falls back to in-app `setTimeout` alerts that
fire while Ground Control is open or backgrounded.

## What it does
| Route | Auth | Purpose |
|-------|------|---------|
| `POST /subscribe` | none | Browser self-registers its push subscription + milestone schedule. |
| `POST /unsubscribe` | none | Remove a subscription by `endpoint`. |
| `POST /send` | `Bearer ADMIN_TOKEN` | Run the due-check now and deliver. For an external cron. |
| `GET /health` | none | Status + the public VAPID key. |

A built-in hourly tick runs the same due-check, so an external cron is optional.
A milestone is delivered once when its `fire` date (YYYY-MM-DD) has arrived
(deduped by `id@fire`); dead subscriptions (404/410) are pruned automatically.

## Setup
```bash
cd push-server
npm install
npm run gen-keys          # prints a VAPID public/private key pair
```
Set environment variables (never commit them):
```
VAPID_PUBLIC_KEY=<public key from gen-keys>
VAPID_PRIVATE_KEY=<private key from gen-keys>   # SECRET — server only
VAPID_SUBJECT=mailto:you@example.com
ADMIN_TOKEN=<a long random string>              # protects POST /send
ALLOW_ORIGIN=https://your-ground-control.app    # REQUIRED — your PWA origin; server refuses to start if unset
STORE_FILE=./subs.json                          # optional; swap for a real DB
MAX_SUBSCRIPTIONS=1000                           # optional; cap on stored subscriptions (default 1000)
```
Run it:
```bash
npm start
```
Then in the PWA: **Settings → Integrations → Background push** — paste the server
URL (e.g. `https://your-push-server.example`) and the **public** VAPID key, and
press *Enable background push*.

## Deploy notes
- Any always-on Node host works (Render, Fly, Railway, a VPS). The built-in
  hourly tick handles scheduling.
- On a serverless host (Vercel/Netlify functions) there is no always-on process:
  map each route to a function, back the store with the platform KV (not a local
  file — serverless filesystems are ephemeral), and drive delivery with the
  platform's **cron** hitting `POST /send` daily (~09:00 in the user's timezone).

## Security model
- The VAPID **private key** and `ADMIN_TOKEN` live only in env. If the private
  key leaks, rotate it (new key pair → redeploy → users re-enable push).
- The VAPID **public key** is public by design (it's in the client).
- `/send` is bearer-protected so only the cron/operator can trigger delivery.
- Push payloads are end-to-end encrypted by the Web Push protocol; the push
  service cannot read them.
- Stored data is a push subscription (an opaque endpoint URL + per-subscription
  keys) plus a minimal schedule: each milestone's `id`, `name`, `project`, and
  `fire` date. The **detailed action text is never sent to or stored on the
  server** — the notification body is generic and the full action is shown in-app
  on tap. No health/portfolio data is stored.

## Reference-grade — what to harden for production
- **Store:** JSON file by default. Replace `store` (three methods: `upsert`,
  `remove`, persistence) with a KV/DB; required on serverless.
- **Schedule freshness:** the PWA re-posts its schedule to `/subscribe` on every
  open (and whenever milestones change), so the server's copy can lag if the user
  never opens the app. Acceptable for the documented "open weekly" usage.
- **Auth on subscribe/unsubscribe:** both are unauthenticated (browsers must be
  able to self-register). A `MAX_SUBSCRIPTIONS` cap and the 16KB body limit blunt
  storage-bloat DoS, and CORS is locked to your origin. For a publicly-exposed
  deployment, add per-subscription ownership proof (a server-issued token returned
  from `/subscribe` and required on `/unsubscribe`) and edge rate limiting — anyone
  who learns a subscription's endpoint URL can otherwise overwrite its schedule or
  delete it. This is a known limitation of the reference server.
