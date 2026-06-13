/* Ground Control — companion Web Push server (VAPID).
 *
 * WHY THIS EXISTS
 * A static PWA cannot deliver push when it is closed: something must hold the
 * VAPID *private* key and POST to each browser's push endpoint on schedule.
 * That "something" is a server, by design of the Web Push spec. The PWA stays
 * static; this small service is the only server piece.
 *
 * WHAT IT DOES
 *   POST /subscribe    { subscription, milestones[] }  -> upsert (browser self-registers)
 *   POST /unsubscribe  { endpoint }                    -> remove
 *   POST /send         (admin)                         -> run the due-check now (for cron)
 *   GET  /health                                       -> status + public key
 * A built-in hourly tick also runs the due-check, so a separate cron is optional.
 *
 * REFERENCE-GRADE, READ BEFORE PRODUCTION USE:
 *   - Subscriptions persist to a JSON file (STORE_FILE). For real scale swap
 *     `store` for a KV/DB — the interface is three methods.
 *   - The VAPID private key and ADMIN_TOKEN come from env, never code. Do not
 *     commit a .env. Generate keys with `npm run gen-keys`.
 *   - CORS is locked to ALLOW_ORIGIN (your PWA origin). /send is bearer-protected.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const webpush = require("web-push");

const PORT = process.env.PORT || 8080;
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN;                      // required — no wildcard default (fail closed)
const STORE_FILE = process.env.STORE_FILE || path.join(__dirname, "subs.json");
const MAX_SUBSCRIPTIONS = Number(process.env.MAX_SUBSCRIPTIONS) || 1000;

if (!PUBLIC_KEY || !PRIVATE_KEY) {
  console.error("Missing VAPID keys. Run `npm run gen-keys` and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.");
  process.exit(1);
}
if (!ALLOW_ORIGIN) {
  console.error("Missing ALLOW_ORIGIN. Set it to your PWA origin (e.g. https://my-app.example) — refusing to start with an open CORS policy.");
  process.exit(1);
}
if (!ADMIN_TOKEN) {
  console.warn("ADMIN_TOKEN is unset — POST /send is disabled (returns 401). The built-in hourly tick still delivers.");
}
webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);

// Constant-time compare so the admin token can't be recovered via response timing.
// Hash to a fixed length first so neither length nor content leaks through timing.
function safeEqual(a, b) {
  if (!a || !b) return false;
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ---- subscription store (file-backed; swap for a real DB in production) ---- */
const store = {
  data: {}, // endpoint -> { subscription, milestones, sent }
  load() {
    try { this.data = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")); } catch (e) { this.data = {}; }
  },
  save() {
    try { fs.writeFileSync(STORE_FILE, JSON.stringify(this.data)); } catch (e) { console.error("store save failed", e.message); }
  },
  upsert(sub, milestones) {
    const k = sub.endpoint;
    const prev = this.data[k] || { sent: {} };
    const sent = prev.sent || {};
    pruneSent(sent);   // keep the dedupe map from growing without bound
    this.data[k] = { subscription: sub, milestones: Array.isArray(milestones) ? milestones : (prev.milestones || []), sent };
    this.save();
  },
  remove(endpoint) { delete this.data[endpoint]; this.save(); }
};
store.load();

/* ---- helpers ---- */
function isoToday() { return new Date().toISOString().slice(0, 10); }

function pruneSent(sent, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  for (const key of Object.keys(sent)) if (sent[key] <= cutoff) delete sent[key];
}

function validSubscription(s) {
  return s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) &&
    s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string";
}

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "", size = 0;
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("payload too large")); req.destroy(); } else body += c; });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function send(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  });
  res.end(JSON.stringify(obj));
}

/* ---- the actual delivery: send any milestone whose fire date has arrived ---- */
let running = false;   // guard so the hourly tick and a /send cron can't double-deliver
async function runDue() {
  if (running) return { skipped: true };
  running = true;
  try {
    const today = isoToday();
    let sent = 0, pruned = 0;
    for (const k of Object.keys(store.data)) {
      const rec = store.data[k];
      for (const m of rec.milestones || []) {
        if (!m.fire || m.fire > today) continue;          // not due yet
        const dedupe = m.id + "@" + m.fire;
        if (rec.sent[dedupe]) continue;                    // already delivered
        // Body is intentionally generic — the detailed action is shown in-app on tap,
        // never stored on or sent through the server.
        const payload = JSON.stringify({ id: m.id, project: m.project, title: m.name, body: "Open Ground Control to review the action." });
        try {
          await webpush.sendNotification(rec.subscription, payload);
          rec.sent[dedupe] = today; sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) { store.remove(k); pruned++; break; } // subscription gone
          else console.error("send error", err.statusCode, err.body || err.message);
        }
      }
    }
    if (sent || pruned) store.save();
    return { sent, pruned, subs: Object.keys(store.data).length };
  } finally {
    running = false;
  }
}

/* ---- HTTP ---- */
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://localhost");

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, publicKey: PUBLIC_KEY });
    }

    if (req.method === "POST" && url.pathname === "/subscribe") {
      const body = await readJson(req);
      if (!validSubscription(body.subscription)) return send(res, 400, { error: "invalid subscription" });
      const isNew = !store.data[body.subscription.endpoint];
      if (isNew && Object.keys(store.data).length >= MAX_SUBSCRIPTIONS) return send(res, 429, { error: "subscription limit reached" });
      store.upsert(body.subscription, body.milestones);
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/unsubscribe") {
      const body = await readJson(req);
      if (!body.endpoint) return send(res, 400, { error: "endpoint required" });
      store.remove(body.endpoint);
      return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/send") {
      const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!ADMIN_TOKEN || !safeEqual(auth, ADMIN_TOKEN)) return send(res, 401, { error: "unauthorized" });
      const result = await runDue();
      return send(res, 200, { ok: true, ...result });
    }

    return send(res, 404, { error: "not found" });
  } catch (e) {
    return send(res, 400, { error: e.message || "bad request" });
  }
});

// Built-in scheduler: check hourly. (A platform cron hitting POST /send works too.)
setInterval(() => { runDue().then((r) => { if (r.sent || r.pruned) console.log("runDue", r); }); }, 60 * 60 * 1000);

server.listen(PORT, () => console.log("Ground Control push server on :" + PORT));
