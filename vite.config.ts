// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Keep if using the tailwindcss/vite plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Keep this
  ],
  server: {
    proxy: {
      // Proxy requests starting with '/gemini-api'
      '/gemini-api': {
        // Target the Google API base URL
        target: 'https://generativelanguage.googleapis.com',
        // Change the origin header for CORS
        changeOrigin: true,
        // Rewrite the path: remove '/gemini-api' prefix
        // The frontend will now call e.g., /gemini-api/v1beta/openai/chat/completions
        // This rewrite leaves /v1beta/openai/chat/completions which is correct for the target
        rewrite: (path) => path.replace(/^\/gemini-api/, ''),
        // Optional: Log proxy events for debugging
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Remove the API key from logs if present in headers/query for security
            const safeUrl = req.url?.replace(/key=([^&]*)/, 'key=REDACTED');
            console.log('Sending Request to Target:', req.method, safeUrl);
            console.log('Target path:', proxyReq.path);
             // Remove Authorization header for logging security
             const safeHeaders = { ...proxyReq.getHeaders() };
             delete safeHeaders['authorization'];
             console.log('Target Headers:', safeHeaders);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
             const safeUrl = req.url?.replace(/key=([^&]*)/, 'key=REDACTED');
            console.log('Received Response from Target:', proxyRes.statusCode, safeUrl);
          });
        },
      },
    },
  },
})