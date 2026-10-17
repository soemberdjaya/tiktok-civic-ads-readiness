import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Layout, Footer } from '../ui/Layout';
import { useSettings } from '../lib/settings';
import { PROVIDERS, getProvider } from '../providers';
import type { ProviderId } from '../providers/types';
import { moveKeys, readKey } from '../store/keys';
import { saveAndTest } from '../lib/connect';
import { Link } from '../lib/router';
import { download, exportHistory, importHistory, wipeEverything } from '../store/transfer';
import { t, fmt } from '../i18n';

export function Settings() {
  const { settings, update, refresh } = useSettings();
  const [providerId, setProviderId] = useState<ProviderId>(settings.provider);
  const [key, setKey] = useState('');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [withMedia, setWithMedia] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const p = getProvider(providerId);

  useEffect(() => setProviderId(settings.provider), [settings.provider]);
  // Reset the form only when the provider changes; saving must not clear the status message.
  useEffect(() => {
    setKey(readKey(providerId));
    setModel(settings.models[providerId] || getProvider(providerId).defaultModel);
    setModels([]);
    setStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);
  useEffect(() => setBaseUrl(settings.baseUrl), [settings.baseUrl]);

  const save = async () => {
    setTesting(true);
    setStatus(null);
    const r = await saveAndTest({ provider: providerId, key, model, baseUrl, keepOnFail: true }, settings, update);
    await refresh();
    setTesting(false);
    if (r.models.length) setModels(r.models);
    if (r.model) setModel(r.model);
    setStatus(
      r.ok
        ? { kind: 'ok', text: `${t.settings.ok} ${fmt(t.settings.modelsLoaded, { n: r.models.length })}` }
        : { kind: 'error', text: fmt(t.settings.savedNoTest, { error: r.error ?? '' }) },
    );
  };

  return (
    <Layout section="settings">
      <main className="mx-auto box-border flex w-full max-w-[760px] flex-1 flex-col gap-6 p-4 sm:p-6">
        <section aria-labelledby="h-model" className="panel">
          <h1 id="h-model" className="m-0 border-b border-line px-6 py-3.5 text-base font-bold">
            {t.settings.model}
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Row label={t.settings.provider} htmlFor="provider">
              <select id="provider" className="field" value={providerId} onChange={(e) => setProviderId(e.target.value as ProviderId)}>
                {PROVIDERS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Row>
            {p.needsBaseUrl && (
              <Row label={t.settings.baseUrl} htmlFor="base-url">
                <input id="base-url" className="field font-mono text-[13px]" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </Row>
            )}
            <Row
              label={t.settings.key}
              htmlFor="api-key"
              aside={
                p.dashboardUrl ? (
                  <a href={p.dashboardUrl} target="_blank" rel="noreferrer noopener" className="text-[13px] font-normal text-muted">
                    {t.settings.keyDashboard}
                  </a>
                ) : null
              }
            >
              <div className="flex gap-2">
                <input
                  id="api-key"
                  type={show ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  className="field min-w-0 flex-1 font-mono text-[13px]"
                  placeholder={p.keyHint}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <button type="button" className="btn" onClick={() => setShow((v) => !v)}>
                  {show ? t.settings.hide : t.settings.show}
                </button>
              </div>
            </Row>
            <Row label={t.settings.modelId} htmlFor="model-id">
              <input
                id="model-id"
                list="model-list"
                className="field font-mono text-[13px]"
                placeholder={t.settings.modelPlaceholder}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <datalist id="model-list">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Row>
            <div className="flex flex-wrap items-center gap-4 px-6 py-4">
              <button type="submit" className="btn btn-primary" disabled={testing || (!key.trim() && !p.needsBaseUrl)}>
                {testing ? t.settings.testing : t.settings.save}
              </button>
              {status && (
                <span role="status" className={'flex-1 text-[13px] ' + (status.kind === 'error' ? 'text-danger-text' : status.kind === 'ok' ? 'text-ok' : 'text-muted')}>
                  {status.text}
                </span>
              )}
              {status?.kind === 'ok' && (
                <Link to="/audit/text" className="text-[13px] font-semibold">
                  {t.settings.back}
                </Link>
              )}
            </div>
          </form>
        </section>

        <section id="data" aria-labelledby="h-data" className="panel">
          <h2 id="h-data" className="m-0 border-b border-line px-6 py-3.5 text-base font-bold">
            {t.settings.storage}
          </h2>
          <Row label={t.settings.keyWhere}>
            <div className="flex flex-wrap gap-x-6 gap-y-2 py-2">
              {(['local', 'session'] as const).map((w) => (
                <label key={w} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="key-storage"
                    checked={settings.keyStorage === w}
                    onChange={async () => {
                      moveKeys(w, PROVIDERS.map((x) => x.id));
                      await update({ keyStorage: w });
                    }}
                  />
                  {w === 'local' ? t.settings.local : t.settings.session}
                </label>
              ))}
            </div>
          </Row>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4 text-[13px]">
            <button type="button" className="link-btn" onClick={async () => download(await exportHistory(withMedia), `civic-ad-readiness-${new Date().toISOString().slice(0, 10)}.json`)}>
              {t.history.export}
            </button>
            <label className="flex items-center gap-1.5 text-muted">
              <input type="checkbox" checked={withMedia} onChange={(e) => setWithMedia(e.target.checked)} />
              {t.history.exportMedia}
            </label>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const n = await importHistory(f);
                  setStatus({ kind: 'info', text: fmt(t.history.imported, { a: n.audits }) });
                } catch (err) {
                  setStatus({ kind: 'error', text: (err as Error).message });
                }
              }}
            />
            <button type="button" className="link-btn" onClick={() => importRef.current?.click()}>
              {t.history.import}
            </button>
            <button
              type="button"
              className="link-btn ml-auto text-danger-text"
              onClick={async () => {
                if (!confirm(t.settings.wipeConfirm)) return;
                await wipeEverything();
                await refresh();
                setKey('');
                setStatus({ kind: 'info', text: t.settings.wiped });
              }}
            >
              {t.settings.wipe}
            </button>
          </div>
        </section>

        <section aria-labelledby="h-caps" className="panel">
          <h2 id="h-caps" className="m-0 border-b border-line px-6 py-3.5 text-base font-bold">
            {t.settings.caps}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-2 text-left text-[13px] text-muted">
                  <th className="px-6 py-2 font-medium">{t.settings.provider}</th>
                  <th className="px-4 py-2 font-medium">{t.modes.text}</th>
                  <th className="px-4 py-2 font-medium">{t.modes.image}</th>
                  <th className="px-4 py-2 font-medium">{t.modes.video}</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDERS.map((x) => (
                  <tr key={x.id} className={'border-b border-line-2 last:border-0 ' + (x.id === providerId ? 'bg-hover' : '')}>
                    <td className="px-6 py-2">{x.name}</td>
                    <td className="px-4 py-2">{x.capabilities.text ? t.settings.yes : '—'}</td>
                    <td className="px-4 py-2">{x.capabilities.image ? t.settings.yes : '—'}</td>
                    <td className="px-4 py-2">{x.capabilities.video === 'native' ? t.settings.native : x.capabilities.video === 'frames' ? t.settings.frames : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <Footer />
      </main>
    </Layout>
  );
}

function Row({ label, htmlFor, aside, children }: { label: string; htmlFor?: string; aside?: ReactNode; children: ReactNode }) {
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div className="grid grid-cols-1 border-b border-line-2 sm:grid-cols-[160px_minmax(0,1fr)]">
      <div className="flex items-baseline justify-between gap-2 px-6 pt-3.5 sm:block sm:pb-3.5">
        <Label {...(htmlFor ? { htmlFor } : {})} className="font-semibold">
          {label}
        </Label>
        {aside && <div className="sm:mt-0.5">{aside}</div>}
      </div>
      <div className="px-6 py-3">{children}</div>
    </div>
  );
}
