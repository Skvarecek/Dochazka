// Minimální service worker — jen kvůli instalovatelnosti PWA.
// ZÁMĚRNĚ NIC NECACHUJE → appka se nikdy nezasekne na staré verzi.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  // Pouze průchod na síť (žádná cache). Splní podmínku instalovatelnosti.
  event.respondWith(fetch(event.request));
});
