/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { parse as parseYaml } from 'yaml';
import { copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Provider domains the browser may contact. Your own custom endpoint or proxy
// is added via VITE_EXTRA_CONNECT_SRC at build time.
const PROVIDER_ORIGINS = [
  'https://api.openai.com',
  'https://generativelanguage.googleapis.com',
  'https://api.deepseek.com',
  'https://openrouter.ai',
  'http://localhost:*',
  'http://127.0.0.1:*',
];

/** YAML files in rules/ are bundled as JSON at build time. */
function yamlRules(): Plugin {
  return {
    name: 'rules-yaml',
    transform(code, id) {
      if (!id.endsWith('.yaml') && !id.endsWith('.yml')) return null;
      return { code: `export default ${JSON.stringify(parseYaml(code))};`, map: null };
    },
  };
}

/**
 * The strict CSP is only set in production builds. The Vite dev server needs
 * inline scripts for hot reload, which a dev CSP would block.
 */
function contentSecurityPolicy(extra: string[]): Plugin {
  const connect = ["'self'", ...PROVIDER_ORIGINS, ...extra].join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      );
    },
  };
}

/**
 * Files go in dist/<base>/ so URLs on the host match URLs on soedja.com.
 * SPA fallback: _redirects (Cloudflare Pages/Netlify) and 404.html (GitHub Pages).
 * Vercel uses vercel.json.
 */
function spaFallback(base: string): Plugin {
  return {
    name: 'spa-fallback',
    apply: 'build',
    closeBundle() {
      const root = resolve(import.meta.dirname, 'dist');
      const app = resolve(root, '.' + base);
      copyFileSync(resolve(app, 'index.html'), resolve(root, '404.html'));
      const rules = base === '/' ? '/*  /index.html  200\n' : `/  ${base}  302\n${base}*  ${base}index.html  200\n`;
      writeFileSync(resolve(root, '_redirects'), rules);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const extra = (env.VITE_EXTRA_CONNECT_SRC ?? '').split(/\s+/).filter(Boolean);
  // The proxy for auto-fetching landing pages is allowed in the CSP.
  if (env.VITE_PROXY_URL) extra.push(new URL(env.VITE_PROXY_URL).origin);
  const base = env.VITE_BASE ?? '/tiktok-civic-ad/';
  return {
    base,
    build: { outDir: 'dist' + base.replace(/\/$/, ''), emptyOutDir: true },
    plugins: [yamlRules(), react(), tailwindcss(), contentSecurityPolicy(extra), spaFallback(base)],
    test: {
      environment: 'node',
      // Evals call real models, so they only run via `pnpm eval`.
      include: process.env.EVAL_PROVIDER ? ['evals/**/*.test.ts'] : ['tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
    },
  };
});
