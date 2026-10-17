import type { ProviderId } from '../providers/types';

/**
 * API keys are stored apart from IndexedDB and are never exported.
 * "This browser" = localStorage, "This session only" = sessionStorage.
 */
const name = (p: ProviderId) => `car.key.${p}`;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function readKey(p: ProviderId): string {
  return safe(() => sessionStorage.getItem(name(p)) ?? localStorage.getItem(name(p)) ?? '', '');
}

export function writeKey(p: ProviderId, key: string, where: 'local' | 'session') {
  safe(() => {
    localStorage.removeItem(name(p));
    sessionStorage.removeItem(name(p));
    if (key) (where === 'local' ? localStorage : sessionStorage).setItem(name(p), key);
  }, undefined);
}

/** Move all keys to the newly chosen storage. */
export function moveKeys(where: 'local' | 'session', providers: ProviderId[]) {
  for (const p of providers) {
    const k = readKey(p);
    if (k) writeKey(p, k, where);
  }
}

export function clearKeys(providers: ProviderId[]) {
  for (const p of providers) writeKey(p, '', 'local');
  // Keys for providers removed from the app are cleared too.
  safe(() => Object.keys(localStorage).filter((k) => k.startsWith('car.key.')).forEach((k) => localStorage.removeItem(k)), undefined);
  safe(() => Object.keys(sessionStorage).filter((k) => k.startsWith('car.key.')).forEach((k) => sessionStorage.removeItem(k)), undefined);
}
