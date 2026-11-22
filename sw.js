// Service worker: paginile se incarca repede si pot fi „instalate” pe ecranul principal.
// Jocul in sine are nevoie de internet (legatura dintre telefoane si laptop).

const CACHE = 'hai-la-tabla-v1';
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
  'lib/peerjs.min.js',
  'lib/qrcode.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
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
