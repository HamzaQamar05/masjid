import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mujtama',
        short_name: 'Mujtama',
        description: 'A mobile-first community app for masjids, MSAs, imams, students, volunteers, and Muslim professionals.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#eef2f5',
        theme_color: '#0f766e',
        icons: [
          {
            src: '/icons/mujtama-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/mujtama-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}']
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
