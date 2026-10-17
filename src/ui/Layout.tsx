import type { ReactNode } from 'react';
import { Link } from '../lib/router';
import { useSettings } from '../lib/settings';
import { Toaster } from '../lib/toast';
import { runningSessions, useSessionVersion } from '../audit/sessionStore';
import { t } from '../i18n';

export type Section = 'audit' | 'history' | 'rules' | 'settings' | 'privacy';

const NAV: { id: Section; to: string; label: string }[] = [
  { id: 'audit', to: '/audit/text', label: t.nav.audit },
  { id: 'history', to: '/history', label: t.nav.history },
  { id: 'rules', to: '/rules', label: t.nav.rules },
  { id: 'settings', to: '/settings', label: t.nav.settings },
];

export function Layout({ section, children }: { section: Section; children: ReactNode }) {
  const { provider, config, hasKey } = useSettings();
  useSessionVersion();
  const running = runningSessions().length > 0;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-x-7 gap-y-1 border-b border-line bg-panel px-4 sm:px-6">
        <Link to="/audit/text" className="py-3 text-base font-bold tracking-tight no-underline">
          {t.app.name}
        </Link>
        <nav aria-label={t.nav.main} className="order-3 flex w-full gap-6 overflow-x-auto sm:order-none sm:w-auto sm:flex-1 sm:self-stretch">
          {NAV.map((n) => (
            <Link
              key={n.id}
              to={n.to}
              aria-current={section === n.id ? 'page' : undefined}
              className={
                'flex items-center whitespace-nowrap py-3 no-underline sm:py-0 ' +
                (section === n.id ? 'font-semibold shadow-[inset_0_-2px_0_var(--color-ink)]' : 'text-muted')
              }
            >
              {n.label}
              {n.id === 'audit' && running && (
                <span role="img" aria-label={t.audit.runningBadge} className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </nav>
        <Link to="/settings" className="ml-auto text-[13px] text-muted no-underline sm:ml-0">
          {hasKey ? `${provider.name.split(' ')[0]} · ${config.model || '—'}` : t.nav.noModel}
        </Link>
      </header>
      {children}
      <Toaster />
    </div>
  );
}

export function Footer() {
  return (
    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 px-4 py-4 text-[13px] text-muted sm:px-6">
      <span>{t.app.footer}</span>
      <Link to="/privacy" className="text-muted">
        {t.app.privacy}
      </Link>
    </p>
  );
}
