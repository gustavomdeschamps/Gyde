// Service worker aposentado. Versões antigas do Gyde guardavam a interface em cache para o "app do navegador"; agora
// o Gyde roda como app de desktop. Este arquivo existe só para quem ainda tem o antigo registrado: ele apaga o cache e
// se desliga, e a página volta a vir sempre do servidor.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((chaves) => Promise.all(chaves.map((c) => caches.delete(c))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll())
    .then((abas) => abas.forEach((aba) => aba.navigate(aba.url))));
});
