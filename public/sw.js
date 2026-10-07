// Service worker: shows reminders pushed by the app and opens the right page on tap.
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || "Моя система", {
    body: d.body || "", tag: d.tag, renotify: !!d.tag, icon: "/icon.svg", data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      try { await w.focus(); await w.navigate(url); return; } catch { /* not controlled: open a new window below */ }
    }
    await self.clients.openWindow(url);
  })());
});
