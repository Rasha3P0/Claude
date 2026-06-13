/* Ground Control service worker
 * - Caches the app shell for offline use
 * - Receives Web Push events and shows notifications
 * - Receives scheduled-alert messages from the page (client-side scheduling)
 * - Routes notification taps back into the app with the milestone id in the URL
 *
 * LIMITATION (MVP, no backend):
 * Client-side scheduling via setTimeout in the page + showNotification here only
 * fires while the PWA is open or backgrounded. For true background push when the
 * app is fully closed, a backend Web Push server is required (phase 2). The page
 * recalculates and re-arms timers on every open, and reminds the user to open the
 * app weekly so the schedule stays fresh.
 */

const CACHE = "ground-control-v1";

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

// Web Push (phase 2 backend). Payload is JSON with the same shape as below.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Ground Control", body: event.data ? event.data.text() : "Alert" };
  }
  event.waitUntil(showAlert(payload));
});

function showAlert(payload) {
  const title = payload.title || "Ground Control";
  const options = {
    body: payload.body || "An alert is due.",
    tag: payload.id || "gc-alert",
    renotify: true,
    requireInteraction: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { id: payload.id || "", project: payload.project || "" },
    actions: [
      { action: "confirm", title: "Confirm" },
      { action: "snooze", title: "Snooze 24h" }
    ]
  };
  return self.registration.showNotification(title, options);
}

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
