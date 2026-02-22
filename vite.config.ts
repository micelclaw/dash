import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 7100,
    proxy: {
      '/api': 'http://127.0.0.1:7200',
      '/ws': { target: 'ws://127.0.0.1:7200', ws: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
