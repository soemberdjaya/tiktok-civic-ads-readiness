import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

/** Tiny History API router. BASE_URL = '/tiktok-civic-ad/' by default. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function currentRoute(): { path: string; query: URLSearchParams } {
  let path = window.location.pathname;
  if (path.startsWith(BASE)) path = path.slice(BASE.length);
  return { path: path.replace(/\/$/, '') || '/', query: new URLSearchParams(window.location.search) };
}

export function href(to: string): string {
  return BASE + (to.startsWith('/') ? to : '/' + to);
}

export function navigate(to: string, replace = false) {
  const url = href(to);
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!url.includes('#')) window.scrollTo(0, 0);
}

export function useRoute() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return route;
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      {...rest}
      href={href(to)}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    />
  );
}
