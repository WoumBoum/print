// Service worker de la caisse : réseau d'abord (toujours la dernière version publiée),
// copie locale en secours si la tablette est hors ligne.
const CACHE = "caisse-v4";
const FICHIERS = [
  "caisse.html", "style.css", "commun.js", "ticket-lecteur.js", "logo.png",
  "icone-192.png", "icone-512.png", "manifest-caisse.webmanifest",
  "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // On ne met en cache que le site, la police et la librairie QR (pas Google Apps Script).
  const h = new URL(e.request.url).hostname;
  if (h !== location.hostname && !["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(h)) return;
  e.respondWith(
    fetch(e.request)
      .then(rep => {
        if (rep.ok || rep.type === "opaque") {
          const copie = rep.clone();
          caches.open(CACHE).then(c => c.put(e.request, copie));
        }
        return rep;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
