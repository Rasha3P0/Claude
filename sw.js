/* Ground Control service worker
 * - Caches the app shell for offline use
 * - Receives Web Push events and shows notifications
 * - Receives scheduled-alert messages from the page (client-side scheduling)
 * - Routes notification taps back into the app with the milestone id in the URL
 *
 * BACKGROUND PUSH (phase 2):
 * True background push when the app is fully closed is delivered by the optional
 * companion server in /push-server (it holds the VAPID private key and POSTs to
 * the push service). This worker handles the resulting `push` event and re-subscribes
 * on `pushsubscriptionchange`. When that server is NOT configured, the page's
 * client-side setTimeout scheduling remains the fallback and only fires while the
 * PWA is open or backgrounded — the page re-arms timers on every open.
 */

const CACHE = "ground-control-v2";

// App shell. CDN bundles are cached on first fetch so the app works offline.
const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Don't fail install if an optional asset 404s.
      Promise.allSettled(SHELL.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigations (so deploys update), cache-first for assets,
// with a runtime cache fallback for offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isNavigation = req.mode === "navigate";

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache same-origin and CDN GET responses for offline.
          if (res && res.status === 200 && (url.origin === self.location.origin || res.type === "cors" || res.type === "basic")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

// Messages from the page: schedule or fire a notification immediately.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    showAlert(data.payload || {});
  }
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Web Push, delivered by the companion server (/push-server). The payload is
// already end-to-end encrypted by Web Push, so only a sender holding the
// subscription keys can deliver a decryptable message; even so we defensively
// validate and clamp every field before it reaches a notification.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Ground Control", body: event.data ? event.data.text() : "Alert" };
  }
  event.waitUntil(showAlert(payload));
});

// Coerce to a bounded string — keeps a malformed/oversized field from breaking
// or polluting the notification.
function clamp(v, max) {
  return (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max);
}

function showAlert(payload) {
  payload = payload && typeof payload === "object" ? payload : {};
  const id = clamp(payload.id, 64);
  const title = clamp(payload.title, 100) || "Ground Control";
  const options = {
    body: clamp(payload.body, 300) || "An alert is due.",
    tag: id || "gc-alert",
    renotify: true,
    requireInteraction: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { id, project: clamp(payload.project, 64) },
    actions: [
      { action: "confirm", title: "Confirm" },
      { action: "snooze", title: "Snooze 24h" }
    ]
  };
  return self.registration.showNotification(title, options);
}

// Push services rotate subscriptions; re-subscribe with the same application
// server key and ask any open page to re-register the new subscription with the
// server. Best-effort — if the key isn't recoverable, the page resubscribes on
// next open from the VAPID key it has in settings.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    let endpoint = null;
    try {
      const key = event.oldSubscription
        && event.oldSubscription.options
        && event.oldSubscription.options.applicationServerKey;
      if (key) {
        const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        endpoint = sub.endpoint;
      }
    } catch (e) { /* fall through to page-driven re-subscribe */ }
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", endpoint }));
  })());
});

self.addEventListener("notificationclick", (event) => {
  const id = (event.notification.data && event.notification.data.id) || "";
  const action = event.action || "open";
  event.notification.close();

  // Deep-link into the alert screen, passing the milestone id and the action.
  const target = `/?alert=${encodeURIComponent(id)}&do=${encodeURIComponent(action)}`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", id, action });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
