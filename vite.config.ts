import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// Tailscale HTTPS certs (generated via `sudo tailscale cert <domain>`)
const tsDomain = 'claw-os.monster-betelgeuse.ts.net';
const certDir = path.resolve(__dirname, '../data/certs');
const tsCert = path.join(certDir, `${tsDomain}.crt`);
const tsKey = path.join(certDir, `${tsDomain}.key`);
const hasTailscaleCerts = fs.existsSync(tsCert) && fs.existsSync(tsKey);

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
    // Self-signed fallback only when Tailscale certs aren't available
    ...(!hasTailscaleCerts ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
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
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 7100,
    https: hasTailscaleCerts
      ? { cert: tsCert, key: tsKey }
      : undefined, // basic-ssl plugin handles self-signed
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7200',
        secure: false,
        changeOrigin: true,
      },
      '/ws': { target: 'ws://127.0.0.1:7200', ws: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
