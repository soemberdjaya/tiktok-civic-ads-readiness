// Optional CORS proxy for Cloudflare Workers. Deploy it yourself: `npx wrangler deploy`.
// Forwards only to allowed hosts and only for your site's origin.
// Usage: https://<worker>/<host>/<path>, e.g. https://<worker>/api.deepseek.com/chat/completions
const ALLOWED_HOSTS = ['api.deepseek.com', 'api.openai.com', 'openrouter.ai', 'generativelanguage.googleapis.com'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowedOrigins = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-goog-api-key, X-Title',
      'Access-Control-Expose-Headers': 'X-Final-Url',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!allowedOrigins.includes(origin)) return new Response('Origin not allowed', { status: 403, headers: cors });

    const url = new URL(request.url);

    // GET /fetch?url=… fetches landing page HTML for reading in the browser.
    // No user headers, GET only, text/html only, 2 MB max.
    if (url.pathname === '/fetch') {
      if (request.method !== 'GET') return new Response('GET only', { status: 405, headers: cors });
      let target;
      try {
        target = new URL(url.searchParams.get('url') ?? '');
      } catch {
        return new Response('Invalid URL', { status: 400, headers: cors });
      }
      if (!['http:', 'https:'].includes(target.protocol)) return new Response('http(s) only', { status: 400, headers: cors });
      const page = await fetch(target, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (civic-ad-readiness landing fetch)', Accept: 'text/html' } });
      const type = page.headers.get('content-type') ?? '';
      if (!type.includes('text/html')) return new Response('Not an HTML page', { status: 415, headers: cors });
      const body = await page.arrayBuffer();
      if (body.byteLength > 2 * 1024 * 1024) return new Response('Page too large', { status: 413, headers: cors });
      return new Response(body, { status: page.status, headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'X-Final-Url': page.url } });
    }

    const [, host, ...rest] = url.pathname.split('/');
    if (!ALLOWED_HOSTS.includes(host)) return new Response('Host not allowed', { status: 400, headers: cors });

    // API keys from the browser are forwarded as-is and never stored.
    const upstream = await fetch(`https://${host}/${rest.join('/')}${url.search}`, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' ? undefined : request.body,
    });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};
