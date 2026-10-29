import { defineConfig } from 'vite';

// Duas páginas: o jogo (index.html) e a Oficina (oficina.html), que só funciona com o servidor em OFICINA=1.
export default defineConfig({ server: { port: 5173 }, build: { rollupOptions: { input: { jogo: 'index.html', oficina: 'oficina.html' } } } });
