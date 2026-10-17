import { useEffect, useState } from 'react';
import type { Audit, AuditResult, Band, Mode, TextInput } from '../types';
import { Layout, Footer } from '../ui/Layout';
import { Link, navigate } from '../lib/router';
import { db, latestResult } from '../store/db';
import { MODE_PATH } from '../audit/useAuditSession';
import { isRunning, useSessionVersion } from '../audit/sessionStore';
import { BAND_COLOR } from '../ui/findingView';
import { t } from '../i18n';

type Row = { audit: Audit; result?: AuditResult };

const MODE_LABEL = { text: t.modes.text, image: t.modes.image, video: t.modes.video };
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function History() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Mode | 'all'>('all');
  const [band, setBand] = useState<Band | 'all' | 'none'>('all');
  // Reload when a background audit finishes so its status updates right away.
  const version = useSessionVersion();

  const load = async () => {
    const audits = await db.audits.orderBy('createdAt').reverse().toArray();
    setRows(await Promise.all(audits.map(async (audit) => ({ audit, result: await latestResult(audit.id) }))));
  };
  useEffect(() => {
    void load();
  }, [version]);

  const needle = q.trim().toLowerCase();
  const shown = (rows ?? []).filter(({ audit, result }) => {
    if (mode !== 'all' && audit.mode !== mode) return false;
    if (band === 'none' ? !!result : band !== 'all' && result?.band !== band) return false;
    if (!needle) return true;
    // Search title and text so old audits can be found from a snippet of the script.
    const text = audit.mode === 'text' ? Object.values(audit.input as TextInput).join(' ') : (audit.input as { caption: string }).caption;
    return `${audit.title} ${text}`.toLowerCase().includes(needle);
  });

  const remove = async (id: string) => {
    if (!confirm(t.history.confirmDelete)) return;
    await db.transaction('rw', db.audits, db.results, async () => {
      await db.results.where('auditId').equals(id).delete();
      await db.audits.delete(id);
    });
    await load();
  };

  return (
    <Layout section="history">
      <main className="mx-auto box-border w-full max-w-[1000px] flex-1 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-xl font-bold">{t.history.title}</h1>
          </div>
          <Link to="/audit/text" className="btn btn-primary no-underline hover:text-white">
            {t.audit.newAudit}
          </Link>
        </div>
        {rows && rows.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className="min-w-0 flex-[1_1_240px]">
              <span className="sr-only">{t.history.search}</span>
              <input type="search" className="field" placeholder={t.history.search} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div role="group" aria-label={t.modes.label} className="flex overflow-hidden rounded-[4px] border border-input">
              {(['all', 'text', 'image', 'video'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={'min-h-10 cursor-pointer border-0 border-l border-input px-3 first:border-l-0 ' + (mode === m ? 'bg-ink text-white' : 'bg-panel')}
                >
                  {m === 'all' ? t.result.tabs.all : MODE_LABEL[m]}
                </button>
              ))}
            </div>
            <label>
              <span className="sr-only">Status</span>
              <select className="field" value={band} onChange={(e) => setBand(e.target.value as typeof band)}>
                <option value="all">{t.history.allStatus}</option>
                {(['blocked', 'high', 'med', 'low'] as const).map((b) => (
                  <option key={b} value={b}>
                    {t.result.band[b]}
                  </option>
                ))}
                <option value="none">{t.history.notAudited}</option>
              </select>
            </label>
          </div>
        )}
        <div className="panel mt-3 overflow-x-auto">
          {rows && rows.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="m-0 font-semibold">{t.history.empty}</p>
              <p className="mb-0 mt-2 flex flex-wrap justify-center gap-4">
                <Link to="/audit/text">{t.modes.text}</Link>
                <Link to="/audit/image">{t.modes.image}</Link>
                <Link to="/audit/video">{t.modes.video}</Link>
              </p>
            </div>
          )}
          {rows && rows.length > 0 && shown.length === 0 && <p className="m-0 px-6 py-5 text-muted">{t.history.noMatch}</p>}
          {shown.length > 0 && (
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-muted">
                  <th className="px-6 py-2.5 font-medium">{t.history.cols.title}</th>
                  <th className="px-4 py-2.5 font-medium">{t.history.cols.type}</th>
                  <th className="px-4 py-2.5 font-medium">{t.history.cols.status}</th>
                  <th className="px-4 py-2.5 font-medium">{t.history.cols.score}</th>
                  <th className="px-4 py-2.5 font-medium">{t.history.cols.created}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ audit, result }) => (
                  <tr
                    key={audit.id}
                    className="cursor-pointer border-b border-line-2 hover:bg-hover"
                    onClick={(e) => {
                      // Buttons and links inside the row have their own actions.
                      if ((e.target as HTMLElement).closest('a,button')) return;
                      navigate(`${MODE_PATH[audit.mode]}?id=${audit.id}`);
                    }}
                  >
                    <td className="px-6 py-3">
                      <Link to={`${MODE_PATH[audit.mode]}?id=${audit.id}`} className="font-semibold no-underline">
                        {audit.title || t.audit.untitled}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{MODE_LABEL[audit.mode]}</td>
                    <td className="px-4 py-3">
                      {isRunning(audit.id) ? (
                        <span className="inline-flex items-center gap-2 text-muted">
                          <span aria-hidden="true" className="inline-block size-2.5 animate-pulse rounded-full bg-ink" />
                          {t.audit.running}
                        </span>
                      ) : result ? (
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: BAND_COLOR[result.band] }} />
                          {t.result.band[result.band]}
                        </span>
                      ) : (
                        <span className="text-muted">{t.history.noResult}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{result && result.band !== 'blocked' ? result.score : '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-muted">{dateFmt.format(audit.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="link-btn text-[13px] text-muted" onClick={() => void remove(audit.id)}>
                        {t.history.delete}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="mb-0 mt-3 text-[13px] text-muted">
          <Link to="/settings#data" className="text-muted">
            {t.history.export}
          </Link>
        </p>
      </main>
      <Footer />
    </Layout>
  );
}
