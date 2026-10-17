import { useSyncExternalStore } from 'react';
import { Link } from './router';

interface Toast {
  id: number;
  text: string;
  link?: { to: string; label: string };
  tone?: 'ok' | 'error';
}

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
let seq = 0;

const emit = () => listeners.forEach((l) => l());

export function toast(text: string, opts: { link?: Toast['link']; tone?: Toast['tone']; ms?: number } = {}) {
  const t: Toast = { id: ++seq, text, link: opts.link, tone: opts.tone };
  toasts = [...toasts, t].slice(-3);
  emit();
  setTimeout(() => dismiss(t.id), opts.ms ?? (opts.link ? 8000 : 3500));
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto flex max-w-[420px] items-center gap-4 rounded-[4px] bg-ink px-4 py-3 text-[13px] text-white"
        >
          <span>{t.text}</span>
          {t.link && (
            <Link to={t.link.to} className="whitespace-nowrap font-semibold text-white underline hover:text-white" onClick={() => dismiss(t.id)}>
              {t.link.label}
            </Link>
          )}
          <button type="button" aria-label="Close" className="ml-auto cursor-pointer border-0 bg-transparent p-1 text-white/70 hover:text-white" onClick={() => dismiss(t.id)}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
