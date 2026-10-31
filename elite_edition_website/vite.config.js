import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import versionPlugin from './vite-plugin-version.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Native high-performance Brotli & Gzip pre-compression plugin
function nativeCompressionPlugin() {
  return {
    name: 'native-pre-compression',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      if (!fs.existsSync(distDir)) return

      let compressedCount = 0
      function compressFile(filePath) {
        try {
          const content = fs.readFileSync(filePath)
          if (content.length < 256) return // Skip tiny files

          // Gzip (.gz) level 9 maximum compression
          const gz = zlib.gzipSync(content, { level: 9 })
          fs.writeFileSync(`${filePath}.gz`, gz)

          // Brotli (.br) quality 11 maximum compression
          const br = zlib.brotliCompressSync(content, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length,
            }
          })
          fs.writeFileSync(`${filePath}.br`, br)
          compressedCount++
        } catch (e) {
          console.warn(`[Compression] Failed to compress ${filePath}:`, e.message)
        }
      }

      function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            walk(fullPath)
          } else if (/\.(js|css|html|svg|json|wasm)$/.test(entry.name) && !entry.name.endsWith('.gz') && !entry.name.endsWith('.br')) {
            compressFile(fullPath)
          }
        }
      }

      walk(distDir)
      console.log(`⚡ [Vite Build] Successfully generated Brotli (.br) and Gzip (.gz) pre-compressed assets for ${compressedCount} files!`)
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionPlugin(), nativeCompressionPlugin()],
  css: {
    postcss: {}
  },
  server: {
    headers: {
      'Service-Worker-Allowed': '/',
    },
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
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
              return 'vendor-react'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query'
            }
            if (id.includes('date-fns')) {
              return 'vendor-date'
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx'
            }
            if (id.includes('html5-qrcode') || id.includes('qrcode')) {
              return 'vendor-qrcode'
            }
            if (id.includes('browser-image-compression')) {
              return 'vendor-compression'
            }
            if (id.includes('socket.io-client') || id.includes('engine.io')) {
              return 'vendor-socket'
            }
          }
        }
      }
    }
  }
})
