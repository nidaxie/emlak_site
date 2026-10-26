import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(import.meta.dirname, '../..');
  const rootEnv = loadEnv(mode, rootDir, '');
  const appEnv = loadEnv(mode, import.meta.dirname, '');

  for (const [key, value] of Object.entries({ ...rootEnv, ...appEnv })) {
    if (key.startsWith('VITE_') && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const rawPort = process.env.WEB_PORT || appEnv.WEB_PORT || rootEnv.WEB_PORT || '3000';
  const parsedPort = Number(rawPort);
  const port = Number.isNaN(parsedPort) || parsedPort <= 0 ? 3000 : parsedPort;
  const basePath = process.env.BASE_PATH || appEnv.BASE_PATH || rootEnv.BASE_PATH || '/';

  return {
    base: basePath,
    envDir: rootDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
