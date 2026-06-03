import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Objetivo: Chrome 109 (la ÚLTIMA versión de Chrome que corre en Windows 7).
// Tailwind v3 (vía PostCSS) genera rgb/rgba puro — compatible con Chrome 109,
// a diferencia de v4 que usa oklch()/color-mix() que ese navegador no entiende.
export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'chrome109',
      cssTarget: 'chrome109',
    },
    server: {
      // COOP/COEP: habilitan SharedArrayBuffer, que MediaPipe necesita para sus
      // hilos WASM. Sin esto el modelo se cuelga al inicializar (gestos muertos).
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
