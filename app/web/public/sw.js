// Service worker do Gyde: guarda a "casca" do app para abrir rápido e funcionar sem internet
// (a Prática em JavaScript roda offline). Sempre tenta a rede primeiro, para as atualizações
// chegarem na hora; a API, as imagens geradas e o vídeo nunca entram no cache.
const CACHE = 'gyde-v11';
// Os arquivos da interface têm hash no nome (gerados pelo Vite) e entram no cache na primeira vez que são usados.
const SHELL = ['/', '/index.html', '/logo.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest', '/runners/js-worker.js', '/runners/py-worker.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (/^\/(api|images)\//.test(url.pathname) || url.pathname.endsWith('.mp4')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error())),
  );
});
