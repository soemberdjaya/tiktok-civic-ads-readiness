import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../lib/settings';
import { PROVIDERS, getProvider } from '../providers';
import type { ProviderId } from '../providers/types';
import { readKey } from '../store/keys';
import { saveAndTest } from '../lib/connect';
import type { Stage } from '../audit/sessionStore';
import { t, fmt } from '../i18n';

/** Right column before a result exists: model setup, audit progress, or an empty state. */
export function AuditAside({ busy, stage, startedAt, onCancel, children }: {
  busy: boolean;
  stage: Stage | null;
  startedAt: number | null;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { hasKey } = useSettings();
  return (
    <aside aria-label="Audit result" className="flex min-w-0 flex-[1_1_400px] flex-col border-line bg-panel lg:border-l">
      {busy ? <Progress stage={stage} startedAt={startedAt} onCancel={onCancel} /> : children ?? (hasKey ? <HowItWorks /> : <QuickSetup />)}
    </aside>
  );
}

const STEPS: Stage[] = ['prepare', 'model', 'retry', 'score'];

function Progress({ stage, startedAt, onCancel }: { stage: Stage | null; startedAt: number | null; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const at = stage ? STEPS.indexOf(stage) : -1;
  const secs = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  return (
    <div className="px-6 py-5" role="status" aria-live="polite">
      <div aria-hidden="true" className="relative h-1 overflow-hidden bg-line-2">
        <div className="absolute inset-y-0 w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-ink" />
      </div>
      <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
        {STEPS.filter((s) => s !== 'retry' || stage === 'retry').map((s) => {
          const i = STEPS.indexOf(s);
          const state = i < at ? 'done' : i === at ? 'now' : 'todo';
          return (
            <li key={s} className={'flex items-center gap-2.5 ' + (state === 'todo' ? 'text-muted' : '')}>
              <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
                {state === 'done' ? (
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="var(--color-ok)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className={'block size-2 rounded-full ' + (state === 'now' ? 'bg-ink' : 'bg-line')} />
                )}
              </span>
              <span className={state === 'now' ? 'font-semibold' : ''}>{t.audit.steps[s]}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex items-center gap-4">
        <button type="button" className="btn" onClick={onCancel}>
          {t.audit.cancel}
        </button>
        <span className="tabular-nums text-[13px] text-muted">{fmt(t.audit.elapsed, { s: secs })}</span>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return <p className="m-0 px-6 py-5 text-muted">{t.start.empty}</p>;
}

/** Set up provider and key without leaving the audit screen. */
function QuickSetup() {
  const { settings, update, refresh } = useSettings();
  const [providerId, setProviderId] = useState<ProviderId>(settings.provider);
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = getProvider(providerId);

  useEffect(() => setKey(readKey(providerId)), [providerId]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await saveAndTest({ provider: providerId, key, model: settings.models[providerId] ?? '', baseUrl }, settings, update);
    await refresh();
    setBusy(false);
    if (!r.ok) setError(r.error ?? null);
  };

  return (
    <form
      className="px-6 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="font-semibold">{t.start.setupTitle}</div>
      <label className="mt-3 block">
        <span className="mb-1.5 block font-semibold">{t.settings.provider}</span>
        <select className="field" value={providerId} onChange={(e) => setProviderId(e.target.value as ProviderId)}>
          {PROVIDERS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      {p.needsBaseUrl && (
        <label className="mt-3 block">
          <span className="mb-1.5 block font-semibold">{t.settings.baseUrl}</span>
          <input className="field" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
      )}
      <label className="mt-3 block" htmlFor="quick-key">
        <span className="mb-1.5 block font-semibold">{t.settings.key}</span>
      </label>
      <div className="flex gap-2">
        <input
          id="quick-key"
          className="field min-w-0 flex-1 font-mono text-[13px]"
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder={p.keyHint}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button type="button" className="btn" onClick={() => setShow((v) => !v)}>
          {show ? t.settings.hide : t.settings.show}
        </button>
      </div>
      {p.dashboardUrl && (
        <p className="mb-0 mt-1.5 text-[13px] text-muted">
          <a href={p.dashboardUrl} target="_blank" rel="noreferrer noopener" className="text-muted">
            {t.settings.keyDashboard}
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-0 mt-3 text-[13px] text-danger-text">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={busy || (!key.trim() && !p.needsBaseUrl)}>
          {busy ? t.settings.testing : t.start.setupSave}
        </button>

      </div>
    </form>
  );
}
