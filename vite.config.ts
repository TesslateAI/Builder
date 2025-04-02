// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on the mode (development, production)
  // process.cwd() ensures it finds .env in the project root
  const env = loadEnv(mode, process.cwd(), '');

  // Determine the target URL for the proxy from the environment variable
  const proxyTargetUrl = env.VITE_API_BASE_URL;
  const needsProxy = proxyTargetUrl && !proxyTargetUrl.startsWith('http://localhost') && !proxyTargetUrl.startsWith('http://127.0.0.1');

  console.log(`[vite.config] Mode: ${mode}`);
  console.log(`[vite.config] VITE_API_BASE_URL: ${proxyTargetUrl}`);
  console.log(`[vite.config] Proxy Enabled: ${needsProxy}`);

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: needsProxy ? {
        // Use a generic proxy prefix that the frontend will call
        '/llm-proxy/v1': {
          target: proxyTargetUrl, // Target the actual API base URL
          changeOrigin: true, // Important for CORS and host header rewriting
          // Rewrite: remove the proxy prefix before forwarding
          // e.g., /llm-proxy/v1/chat/completions -> /chat/completions
          rewrite: (path) => path.replace(/^\/llm-proxy\/v1/, ''),
          // Optional: Log proxy events for debugging
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              const safeUrl = req.url?.replace(/key=([^&]*)/, 'key=REDACTED');
              console.log('Proxy Sending Request to Target:', req.method, safeUrl);
              console.log('Proxy Target Path:', proxyReq.path);
              const safeHeaders = { ...proxyReq.getHeaders() };
              delete safeHeaders['authorization']; // Redact auth header
              console.log('Proxy Target Headers:', safeHeaders);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              const safeUrl = req.url?.replace(/key=([^&]*)/, 'key=REDACTED');
              console.log('Proxy Received Response from Target:', proxyRes.statusCode, safeUrl);
            });
          },
        }
      } : undefined, // Disable proxy if target is localhost
    },
  }
})