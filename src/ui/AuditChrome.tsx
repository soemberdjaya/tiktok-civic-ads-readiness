import { useState, type ReactNode } from 'react';
import type { Campaign, Mode } from '../types';
import { Link } from '../lib/router';
import { useSettings } from '../lib/settings';
import { MODE_PATH } from '../audit/useAuditSession';
import type { UiError } from '../audit/errors';
import { CampaignDialog } from './CampaignDialog';
import { t, fmt } from '../i18n';

interface Props {
  mode: Mode;
  title: string;
  onTitle: (s: string) => void;
  campaign: Campaign;
  onCampaign: (c: Campaign) => void;
  hasResult: boolean;
  busy: boolean;
  error: UiError | null;
  canRun: boolean;
  onRun: () => void;
  onNew: () => void;
  extraActions?: ReactNode;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'text', label: t.modes.text },
  { id: 'image', label: t.modes.image },
  { id: 'video', label: t.modes.video },
];

export function AuditChrome(p: Props) {
  const { hasKey } = useSettings();
  const [open, setOpen] = useState(false);
  const core = p.campaign.coreMessage.trim();
  return (
    <div className="border-b border-line bg-panel px-4 pt-3.5 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="text-[13px] text-muted">
            <Link to="/history" className="text-muted no-underline">
              {t.nav.audit}
            </Link>{' '}
            / {p.title || t.audit.newTitle}
          </div>
          <label className="sr-only" htmlFor="audit-title">
            {t.audit.titleLabel}
          </label>
          <input
            id="audit-title"
            value={p.title}
            placeholder={t.audit.newTitle}
            onChange={(e) => p.onTitle(e.target.value)}
            className="-mx-1 mt-0.5 w-full rounded-[4px] border-0 bg-transparent px-1 text-xl font-bold placeholder:text-ink hover:bg-hover focus:bg-hover focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t.audit.editCampaign}
            className="-mx-1 mt-0.5 cursor-pointer rounded-[4px] border-0 bg-transparent px-1 py-0.5 text-left text-[13px] text-muted hover:bg-hover hover:text-ink"
          >
            {fmt(t.audit.campaignSummary, { objective: p.campaign.objective, age: p.campaign.minAge })}
            {' · '}
            <span className={core ? '' : 'text-warn'}>{core ? fmt(t.audit.coreSet, { core: core.length > 60 ? core.slice(0, 60) + '…' : core }) : t.audit.coreMissing}</span>
            <svg className="ml-1.5 inline align-[-1px]" width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M8.5 1.5l2 2L4 10H2V8z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {p.extraActions}
          {p.hasResult && !p.busy && (
            <button type="button" className="btn" onClick={p.onNew}>
              {t.audit.newAudit}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={p.busy || !p.canRun || !hasKey}
            onClick={p.onRun}
            title={p.canRun ? t.audit.shortcut : undefined}
          >
            {p.busy ? t.audit.running : p.hasResult ? t.audit.rerun : t.audit.run}
          </button>
        </div>
      </div>

      {!hasKey && (
        // On wide screens the setup form is in the right panel; on phones that panel is far below.
        <p role="status" className="mb-0 mt-3 rounded-[4px] border border-notice-line bg-notice px-3.5 py-2.5 text-[13px] lg:hidden">
          {t.audit.needKey}{' '}
          <Link to="/settings" className="font-semibold">
            {t.audit.openSettings}
          </Link>
        </p>
      )}
      {p.error && (
        <p role="alert" className="mb-0 mt-3 rounded-[4px] border border-line bg-hover px-3.5 py-2.5 text-[13px] text-danger-text">
          {p.error.text}{' '}
          {p.error.settings && (
            <Link to="/settings" className="font-semibold text-ink">
              {t.audit.openSettings}
            </Link>
          )}
        </p>
      )}

      <div role="tablist" aria-label={t.modes.label} className="mt-3 flex gap-7">
        {MODES.map((m) => (
          <Link
            key={m.id}
            role="tab"
            aria-selected={p.mode === m.id}
            to={MODE_PATH[m.id]}
            className={'py-2.5 no-underline ' + (p.mode === m.id ? 'font-semibold shadow-[inset_0_-2px_0_var(--color-primary)]' : 'text-muted')}
          >
            {m.label}
          </Link>
        ))}
      </div>

      <CampaignDialog open={open} onOpenChange={setOpen} value={p.campaign} onSave={p.onCampaign} />
    </div>
  );
}
