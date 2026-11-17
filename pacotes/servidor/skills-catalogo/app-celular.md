---
id: app-celular
nome: App para celular (PWA)
descricao: Transforma um site em app instalável no celular, com manifest, ícone e funcionamento sem internet.
icone: smartphone
categoria: Aplicativos e APIs
comando: /pwa
gatilhos: app para celular, aplicativo, pwa, instalar no celular, offline, android, ios
---
## Passos
1. Diga quando PWA basta (a maioria dos apps simples) e quando precisa de app nativo (Bluetooth avançado, loja obrigatória).
2. Crie `manifest.webmanifest` com name, short_name, start_url, display "standalone", cores e ícones 192 e 512.
3. Registre um service worker que guarda os arquivos principais em cache.
4. Mostre como testar: Chrome > DevTools > Application > Manifest e "Instalar app".
5. Lembre que precisa de HTTPS (ou localhost).
## Checklist
- Manifest com ícones 192 e 512.
- Service worker registrado.
- Explica HTTPS.
- Telas pensadas para toque (botões de 44px ou mais).
## Exemplo
Entrada: "quero meu site de receitas como app"
Saída: manifest completo, `sw.js` com cache dos arquivos e `navigator.serviceWorker.register('/sw.js')` no HTML.
## Erros comuns
- Ícone faltando e o botão "instalar" não aparece.
- Cache que nunca atualiza (sem versão no nome do cache).
- Testar por http num IP da rede (não funciona sem HTTPS).
