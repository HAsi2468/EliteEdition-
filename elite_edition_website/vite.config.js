import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import versionPlugin from './vite-plugin-version.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin()],
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('html5-qrcode')) {
              return 'vendor-qrcode';
            }
            if (id.includes('browser-image-compression')) {
              return 'vendor-compression';
            }
            if (id.includes('socket.io-client') || id.includes('engine.io')) {
              return 'vendor-socket';
            }
          }
        }
      }
    }
  }
})
