/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import fs from 'fs';

// HTTPS cert priority:
// 1. Internal cert signed by Caddy CA (works for VPN IPs + localhost)
// 2. Tailscale cert (works for *.ts.net domain)
// 3. No certs → plain HTTP (localhost is exempt from HTTPS for PWA/service workers)
const certBase = process.env.CLAW_CERT_PATH || '/var/lib/micelclaw/certs';
const internalCertDir = path.join(certBase, 'internal');
const internalCert = path.join(internalCertDir, 'server.crt');
const internalKey = path.join(internalCertDir, 'server.key');
const hasInternalCerts = fs.existsSync(internalCert) && fs.existsSync(internalKey);

const tsDomain = 'micelclaw-os.monster-betelgeuse.ts.net';
const certDir = certBase;
const tsCert = path.join(certDir, `${tsDomain}.crt`);
const tsKey = path.join(certDir, `${tsDomain}.key`);
const hasTailscaleCerts = fs.existsSync(tsCert) && fs.existsSync(tsKey);

const useInternalCerts = hasInternalCerts;
const useTailscaleCerts = !useInternalCerts && hasTailscaleCerts;

/**
 * Vite plugin that adds Private Network Access (PNA) headers to all responses.
 * Required by Brave/Chrome when accessing the dev server via Tailscale CGNAT IPs (100.x.x.x).
 * Without this, fetch() calls fail with "Failed to fetch" even though navigation works.
 */
function privateNetworkAccess(): PluginOption {
  return {
    name: 'private-network-access',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Request-Private-Network');
        // Prevent aggressive caching on mobile browsers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    privateNetworkAccess(),
    react(),
    tailwindcss(),
    // Análisis de bundle bajo demanda: ANALYZE=1 [ANALYZE_OUT=<ruta.html>] npx vite build
    ...(process.env.ANALYZE
      ? [visualizer({
          filename: process.env.ANALYZE_OUT || 'bundle-analysis.html',
          gzipSize: true,
          brotliSize: false,
          template: 'treemap',
        }) as PluginOption]
      : []),
    VitePWA({
      registerType: 'autoUpdate',
      // G5: switched from `generateSW` to `injectManifest` so we can ship
      // a custom Service Worker with `push` + `notificationclick` handlers
      // (workbox auto-precaching kept via `precacheAndRoute` inside sw.ts).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Micelclaw',
        short_name: 'Micelclaw',
        description: 'Personal cloud OS',
        theme_color: '#06060a',
        background_color: '#06060a',
        display: 'fullscreen',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Receive shared photos/videos from the phone's gallery. The custom SW
        // (src/sw.ts) intercepts POST /share-target, caches the blobs and
        // redirects to /photos?shared=1 where the upload dialog enqueues them.
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{ name: 'media', accept: ['image/*', 'video/*'] }],
          },
        },
      },
      // With injectManifest, `workbox.globPatterns` becomes
      // `injectManifest.globPatterns`. Same file set.
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true,
    port: 7100,
    // Permite servir el dash por los dominios locales `.claw` (acceso por nombre +
    // página /wake a la que redirige Caddy). Sin esto, Vite dev bloquea el Host
    // con 403 "host not allowed". En producción (build estático) no aplica.
    allowedHosts: ['.claw'],
    https: useInternalCerts
      ? { cert: internalCert, key: internalKey }
      : useTailscaleCerts
        ? { cert: tsCert, key: tsKey }
        : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7200',
        secure: false,
        changeOrigin: true,
      },
      '/ws': { target: 'ws://127.0.0.1:7200', ws: true },
      // Mathesar (tab Databases) cablea rutas absolutas de raíz (/static, /api/rpc…); su
      // SPA no soporta subpath. Core las proxya al contenedor; aquí las reenviamos a Core
      // (las /api/* ya van por '/api' arriba). El dash no usa estas rutas en bare-root
      // (su cliente api prefija /api/v1) → sin colisión. Equivalente en prod = Caddy.
      ...Object.fromEntries(
        ['/static', '/media', '/auth', '/files', '/bulk_insert', '/i18n'].map((p) => [
          p, { target: 'http://127.0.0.1:7200', secure: false, changeOrigin: true },
        ]),
      ),
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Chunking conservador de vendors pesados: agrupa cada familia en su
        // propio chunk (se descarga solo cuando un módulo lazy la importa) y
        // evita que un vendor grande se duplique entre chunks de módulos.
        // Deliberadamente NO se chunkan react/react-dom (riesgo de romper el
        // orden de inicialización). node_modules va con layout pnpm
        // (.pnpm/<pkg>@<ver>/node_modules/<pkg>/…), por eso los matchers son
        // por substring y el de d3 usa regex de segmento (d3 o d3-*).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tiptap')) return 'tiptap';
          if (id.includes('@xyflow')) return 'xyflow';
          if (id.includes('@excalidraw')) return 'excalidraw';
          if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror') || id.includes('@lezer')) return 'codemirror';
          if (id.includes('recharts')) return 'charts';
          // Utilidades compartidas entre familias de chunks (three3d ↔ excalidraw ↔
          // lobehub): con chunk propio no pegan chunks grandes entre sí (evita el
          // aviso "Circular chunk: three3d -> excalidraw" y que abrir Excalidraw
          // arrastre el chunk three3d entero).
          if (/[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:lodash-es|@babel[\\/]runtime|polished|tinycolor2)[\\/]/.test(id)) return 'vendor-utils';
          // Renderer 3D del Knowledge Graph — solo se carga por import() dinámico.
          // OJO: antes del chunk d3 (su regex atraparía d3-force-3d).
          if (/[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:three|3d-force-graph|three-forcegraph|three-render-objects|three-spritetext|d3-force-3d|data-bind-mapper|kapsule|accessor-fn|float-tooltip)[\\/]/.test(id)) return 'three3d';
          if (/[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?d3(?:-[^\\/]+)?[\\/]/.test(id)) return 'd3';
          if (id.includes('@xterm')) return 'xterm';
          // OJO: NO chunkar la familia markdown (react-markdown/remark/rehype/
          // highlight.js) manualmente: crea un side-effect import estático del
          // entry al chunk (rollup preserva orden de ejecución) y el arranque
          // descargaría 335 KB. El React.lazy de MarkdownRenderer ya hace el
          // split de forma natural, solo bajo demanda.
          if (id.includes('jspdf')) return 'jspdf';
          return undefined;
        },
      },
    },
  },
});
