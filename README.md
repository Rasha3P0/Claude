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
  `push_subscription`). Seed data (3 June sessions, 8 trading milestones, the
  work-stress calendar) loads once on first launch.
- **Week type** (HIGH / MEDIUM / LOW) is read from the stress calendar and drives
  the targets, the orientation block, and the bottom-nav active colour.
- **Notifications:** scheduled client-side. On every open the app recomputes each
  milestone's next-fire date and arms `setTimeout` timers that ask the service
  worker to show a notification. Tapping a notification deep-links into the
  full-screen alert card (Confirm / Snooze 24h / Dismiss).
- **Drive write-back (MVP):** Confirm/Dismiss generates a structured markdown log
  block you copy to your portfolio dashboard, plus an **Open Drive** button.

## Known limitations (MVP)

- **Background push:** client-side `setTimeout` scheduling only fires while the
  PWA is open or backgrounded. True push when the app is fully closed needs a
  backend Web Push server with VAPID keys (phase 2). Open the app weekly to
  refresh the schedule.
- **Drive write is copy/paste**, not a direct API write. OAuth-based append to
  the linked file is phase 2 (marked with a TODO in `index.html`).
- **API coach layer** is wired but disabled — static rules ship by default
  (browser calls to the model API need a key-bearing proxy; see the TODO block).
