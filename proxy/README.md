# Optional CORS proxy

Some providers block direct calls from the browser. If that happens, deploy this small proxy to your own Cloudflare account.

1. Set `ALLOWED_ORIGINS` in `wrangler.toml` to your site's address.
2. `npx wrangler deploy`
3. Build the app with the worker address allowed in the CSP:
   `VITE_EXTRA_CONNECT_SRC=https://civic-ad-readiness-proxy.<account>.workers.dev pnpm build`
4. In Settings, choose "OpenAI-compatible endpoint" and enter the endpoint address, for example
   `https://civic-ad-readiness-proxy.<account>.workers.dev/api.deepseek.com`

For the **Fetch** button in the landing page field, build with the proxy address:

```bash
VITE_PROXY_URL=https://civic-ad-readiness-proxy.<account>.workers.dev pnpm build
```

The `GET /fetch?url=…` endpoint only fetches HTML pages (max 2 MB) and does not forward the user's headers.

The proxy stores nothing. The API key is forwarded to the provider in the request header.
