/** Optional proxy URL (proxy/worker.js). Without it, landing page text is pasted manually. */
export const PROXY_URL = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

const MAX_CHARS = 6000;

/** Fetch the landing page's main text via the proxy, stripping nav, scripts, and footer. */
export async function fetchLandingText(url: string, signal?: AbortSignal): Promise<{ text: string; finalUrl: string }> {
  const res = await fetch(`${PROXY_URL}/fetch?url=${encodeURIComponent(url)}`, { signal });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 120)}`);
  return { text: extractText(await res.text()), finalUrl: res.headers.get('X-Final-Url') ?? url };
}

export function extractText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,svg,iframe,nav,header,footer,form,[aria-hidden="true"]').forEach((n) => n.remove());
  const root = doc.querySelector('main, article, [role=main]') ?? doc.body;
  // Separate blocks with newlines so quotes can still be matched per sentence.
  root?.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,div,section,br').forEach((n) => n.append('\n'));
  const text = (root?.textContent ?? '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS).trimEnd() + '…' : text;
}
