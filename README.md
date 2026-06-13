# Ground Control

A persistent second brain (PWA) for managing four interlocking systems: life
systems (fitness volume, diet, energy), a trading portfolio (milestone alerts +
Drive write-back), a notification layer, and structured logging. Built per the
Ground Control Master Build Brief v2.0.

Dashboard-first, mobile-only, peer-level and analytical in tone. Context before
input, never a blank form.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The complete React app (React 18 + Babel via CDN, no build step) |
| `manifest.json` | PWA install manifest |
| `sw.js` | Service worker — app-shell cache, offline, push + scheduled notifications |
| `vercel.json` | Vercel deployment config (headers, clean URLs) |
| `netlify.toml` | Netlify deployment config (SPA fallback, headers) |
| `icons/` | App icons (192/512 standard + maskable, 180 apple-touch) |
| `make_icons.py` | Pure-stdlib generator that produced the icons (re-run to regenerate) |
| `push-server/` | Optional companion Web Push (VAPID) server for background push when the app is closed |

## Deploy

This is a static site with no build step. Deploy the repository root as-is.

**Vercel**
```
npm i -g vercel
vercel        # first run links/creates the project
vercel --prod
```
Or import the repo at vercel.com — framework preset: **Other**, build command:
**none**, output directory: **./**.

**Netlify**
```
npm i -g netlify-cli
netlify deploy --prod --dir .
```
Or drag the folder into the Netlify dashboard. `netlify.toml` configures the SPA
fallback and the service-worker headers.

Once deployed over HTTPS: open the URL on the phone, then **Add to Home Screen**.
On first load it asks for notification permission (needed for time-critical
trading and check-in alerts).

## How it works

- **Storage:** everything lives in `localStorage` (keys: `gc_settings`,
  `gc_seeded`, `log_YYYY-MM-DD`, `milestone_[id]`, `alert_log_[id]_[ts]`,
  `push_subscription`, `gc_events`, `gc_milestone_seen`). Daily logs may carry an
  optional `wins: [{id,text,category,ts}]` array and an `experiment` record;
  missing keys on legacy entries are treated as empty. Seed data (3 June sessions,
  8 trading milestones, the work-stress calendar, a 16-item wins set for the
  current day, and three July personal events) loads once on first launch.
- **Week type** (HIGH / MEDIUM / LOW) is the **higher of work-stress and
  life-stress** — work comes from the stress calendar, life from a heavy-event
  cluster in `gc_events`. The effective type drives the targets, orientation
  block, coach, and bottom-nav active colour; Today shows both when they differ.
- **Today** also carries an editable quick-win focus list, a Wins card (capture +
  history), and a rotating daily experiment recorded for Patterns correlation.
- **Streaks** reuse the reward layer: the per-day moment is unchanged, and 3/7/14/
  30-day (and beyond) milestones add a larger celebration on top, once each.
- **Notifications:** scheduled client-side. On every open the app recomputes each
  milestone's next-fire date and arms `setTimeout` timers that ask the service
  worker to show a notification. Tapping a notification deep-links into the
  full-screen alert card (Confirm / Snooze 24h / Dismiss).
- **Drive write-back:** Confirm/Dismiss always generates a structured markdown log
  block you can copy. If you connect Google Drive (**Settings → Integrations**),
  the alert also offers **Write to Drive** — a direct OAuth append to a dedicated
  log file. It uses a public OAuth client id (no secret) and the narrow
  `drive.file` scope, so the app can only ever touch its own log file; the access
  token is held in memory only and never persisted.
- **Background push:** connect the companion **push server** (`push-server/`) under
  Settings → Integrations to receive trading alerts when the app is fully closed.
  The server holds the VAPID private key and delivers on schedule; the PWA only
  subscribes and hands over its schedule. Without it, the client-side fallback
  below applies.

## Integrations (optional, off by default)

Both are configured in **Settings → Integrations** and stay inert until you add
credentials — the app ships and works unchanged without them.

- **Google Drive write-back** needs a Google OAuth 2.0 **Web** client id (no
  secret). Add your PWA origin to the client's authorised JavaScript origins,
  paste the client id, and press *Connect Drive*.
- **Background push** needs the companion server in `push-server/` (see its
  README): generate VAPID keys, deploy it, then paste the server URL and the
  **public** VAPID key and press *Enable background push*.

## Known limitations (MVP)

- **Background push requires the companion server.** A static PWA cannot deliver
  push when closed — the Web Push spec needs a server holding the VAPID private
  key. If you don't deploy `push-server/`, the app falls back to client-side
  `setTimeout` alerts that only fire while it is open or backgrounded; open it
  weekly to refresh the schedule.
- **Drive direct-write needs the CDN-loaded Google Identity Services script** and
  network access; where that is blocked (or Drive isn't connected) the alert
  falls back to copy/paste.
- **API coach layer** is wired but disabled — static rules ship by default
  (browser calls to the model API need a key-bearing proxy; see the TODO block).
