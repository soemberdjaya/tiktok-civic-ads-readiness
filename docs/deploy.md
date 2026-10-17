# Deploy

The build outputs `dist/tiktok-ads/`, so the URL is the same wherever it is hosted: `<domain>/tiktok-ads/`.

## Option A: soedja.com/tiktok-ads (recommended)

1. Deploy this repo to Vercel as a separate project. `vercel.json` already configures the build, the SPA fallback, and asset caching.
   The result is something like `https://tiktok-civic-ads-readiness.vercel.app/tiktok-ads/`.
2. In the soedjacom project, set the environment variable:

   ```
   TIKTOK_ADS_ORIGIN=https://tiktok-civic-ads-readiness.vercel.app
   ```

3. Redeploy soedjacom. `next.config.ts` rewrites `/tiktok-ads/*` to that origin, and `middleware.ts` excludes `/tiktok-ads` from next-intl locale routing.

Without `TIKTOK_ADS_ORIGIN`, the rewrite is off and soedjacom is unchanged.

Tested locally on 17 Oct 2026: soedjacom (`next dev`) plus a production build of the app plus a real DeepSeek audit through `/tiktok-ads`, with the production CSP enabled.

## Option B: self-host

| Host | How |
|---|---|
| Vercel | Import the repo. `vercel.json` is complete. |
| Cloudflare Pages | Build command `pnpm build`, output `dist`. `dist/_redirects` is generated automatically. |
| GitHub Pages | Publish `dist/`. `404.html` is generated automatically for deep routes. |

At the domain root: `VITE_BASE=/ pnpm build`.

## Build variables

| Variable | Value |
|---|---|
| `VITE_BASE` | Base path. Default `/tiktok-ads/`. |
| `VITE_PROXY_URL` | URL of `proxy/worker.js`. Enables the **Fetch** button for the landing page and is added to the CSP automatically. |
| `VITE_EXTRA_CONNECT_SRC` | Extra domains for the CSP `connect-src`, such as a custom endpoint. Separate with spaces. |
