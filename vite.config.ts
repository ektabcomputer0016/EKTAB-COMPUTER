import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { onRequestPost } from './functions/api/applications';

const port = Number(process.env.PORT ?? 5173);
const root = path.resolve(import.meta.dirname);
const mode = process.env.NODE_ENV ?? 'development';
const env = loadEnv(mode, root, '');
const functionEnv = {
  SUPABASE_URL:
    process.env.SUPABASE_URL ?? env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY ??
    env.SUPABASE_ANON_KEY ??
    env.VITE_SUPABASE_ANON_KEY ??
    '',
};

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${port}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

function localPagesFunction(): Plugin {
  return {
    name: 'ektab-local-pages-functions',
    configureServer(server) {
      server.middlewares.use(
        async (
          request: IncomingMessage,
          response: ServerResponse,
          next: (error?: unknown) => void,
        ) => {
          const pathname = request.url?.split('?')[0];
          if (pathname !== '/api/applications') {
            next();
            return;
          }
          if (request.method !== 'POST') {
            response.statusCode = 405;
            response.setHeader('Allow', 'POST');
            response.end();
            return;
          }

          try {
            const chunks: Uint8Array[] = [];
            let bodySize = 0;
            for await (const chunk of request) {
              const bytes =
                typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
              bodySize += bytes.byteLength;
              if (bodySize > 24_000) {
                response.statusCode = 413;
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({ error: 'The application is too large.' }));
                request.resume();
                return;
              }
              chunks.push(bytes);
            }

            const headers = new Headers();
            for (const [name, value] of Object.entries(request.headers)) {
              if (value !== undefined && name !== 'host' && name !== 'content-length') {
                headers.set(name, Array.isArray(value) ? value.join(', ') : value);
              }
            }
            const origin = `http://${request.headers.host ?? 'localhost'}`;
            const forwarded = new Request(new URL(request.url ?? '/', origin), {
              method: 'POST',
              headers,
              body: Buffer.concat(chunks),
            });
            const result = await onRequestPost({ request: forwarded, env: functionEnv });
            response.statusCode = result.status;
            result.headers.forEach((value, name) => {
              if (name !== 'content-length' && name !== 'transfer-encoding') {
                response.setHeader(name, value);
              }
            });
            response.end(await result.text());
          } catch {
            server.config.logger.error('Local application function failed.');
            if (!response.headersSent) {
              response.statusCode = 500;
              response.setHeader('Content-Type', 'application/json');
            }
            response.end(JSON.stringify({ error: 'The application could not be processed.' }));
          }
        },
      );
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), localPagesFunction()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root,
  build: {
    outDir: path.resolve(root, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
          if (id.includes('/node_modules/qrcode.react/')) return 'qr-code';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'react-vendor';
          }
        },
      },
    },
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
});
