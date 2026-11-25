import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_PROXY_');
  const proxy =
    command === 'serve'
      ? new URL(env.API_PROXY_TARGET || 'http://127.0.0.1:3000')
      : undefined;
  if (
    proxy &&
    (!['http:', 'https:'].includes(proxy.protocol) ||
      proxy.href !== proxy.origin + '/')
  ) {
    throw new Error('API_PROXY_TARGET must be an HTTP(S) origin');
  }
  return {
    plugins: [react(), tailwind()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: proxy
        ? { '/api': { target: proxy.origin, changeOrigin: true } }
        : undefined,
    },
  };
});
