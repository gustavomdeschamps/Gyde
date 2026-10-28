// Build da interface do Gyde. `npm run build` gera pacotes/interface/dist (o que o servidor entrega).
// `npm run dev:web` abre um servidor de desenvolvimento que repassa a API para o Gyde em http://127.0.0.1:3210.
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

const raiz = import.meta.dirname;
const servidor = `http://127.0.0.1:${process.env.PORT || 3210}`;

export default defineConfig({
  root: raiz,
  plugins: [svelte({ configFile: path.join(raiz, 'svelte.config.js') })],
  resolve: { alias: { $contratos: path.join(raiz, '..', 'compartilhado', 'contratos.ts') } },
  build: { outDir: path.join(raiz, 'dist'), emptyOutDir: true, target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, proxy: { '/api': servidor, '/images': servidor, '/vendor': servidor } },
});
