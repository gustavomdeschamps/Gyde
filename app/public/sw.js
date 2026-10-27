// Service worker do Gyde: guarda a "casca" do app para abrir rápido e funcionar sem internet
// (a Prática em JavaScript roda offline). Sempre tenta a rede primeiro, para as atualizações
// chegarem na hora; a API, as imagens geradas e o vídeo nunca entram no cache.
const CACHE = 'gyde-v9';
const SHELL = [
  '/', '/index.html', '/style.css', '/skills.css', '/recursos.css', '/agente.css', '/app.js', '/onboarding.js', '/pratica.js',
  '/skills.js', '/turmas.js', '/agente.js', '/icones.js', '/runner.js', '/passo-a-passo.js', '/projeto.js', '/runners/js-worker.js',
  '/runners/py-worker.js', '/logo.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest',
];

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
