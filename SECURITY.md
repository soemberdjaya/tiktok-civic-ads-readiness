# Security

## API keys

API keys are stored in the user's browser localStorage or sessionStorage and sent directly to the chosen provider. Keys never go into IndexedDB, export files, or any maintainer-run server.

Because keys live in the browser, an XSS flaw could leak them. Mitigations:

- A strict Content Security Policy in the production build (`vite.config.ts`). `connect-src` only allows provider domains.
- No third-party scripts, CDNs, or analytics. Fonts are self-hosted.
- Dependencies are pinned with `pnpm-lock.yaml`.

Advise users to use a dedicated key with a usage limit, and to choose "This session only" on shared computers.

## Reporting a vulnerability

Email agie@soemberdjaya.com with the subject `[SECURITY] civic-ad-readiness`. Do not open a public issue for an unfixed vulnerability.
