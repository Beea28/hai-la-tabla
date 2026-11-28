// Service worker: paginile se incarca repede si pot fi „instalate” pe ecranul principal.
// Jocul in sine are nevoie de internet (legatura dintre telefoane si laptop).

const CACHE = 'hai-la-tabla-v3';
const FISIERE = [
  './',
  'index.html',
  'ecran.html',
  'telefon.html',
  'comun.css',
  'ecran.css',
  'telefon.css',
  'continut.js',
  'retea.js',
  'sunet.js',
  'ecran.js',
  'telefon.js',
  'lib/mqtt.min.js',
  'lib/qrcode.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  // partea comuna pentru Tomapan si Avioanele
  'comun/baza.js',
  'comun/gazda.js',
  'comun/telecomanda.js',
  'comun/jocuri.css',
  'comun/pagina.css',
  // Tomapan
  'tomapan/',
  'tomapan/index.html',
  'tomapan/ecran.html',
  'tomapan/telefon.html',
  'tomapan/stil.css',
  'tomapan/reguli.js',
  'tomapan/ecran.js',
  'tomapan/telefon.js',
  'tomapan/manifest.webmanifest',
  'tomapan/icons/icon-192.png',
  'tomapan/icons/apple-touch-icon.png',
  // Avioanele
  'avioane/',
  'avioane/index.html',
  'avioane/ecran.html',
  'avioane/telefon.html',
  'avioane/stil.css',
  'avioane/avion.js',
  'avioane/ecran.js',
  'avioane/telefon.js',
  'avioane/manifest.webmanifest',
  'avioane/icons/icon-192.png',
  'avioane/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FISIERE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chei) => Promise.all(chei.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // intai internetul (ca actualizarile sa apara imediat), apoi copia salvata
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
