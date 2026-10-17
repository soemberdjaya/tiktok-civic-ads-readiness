import { useState, type KeyboardEvent } from 'react';
import type { Finding, TextField, TextInput } from '../types';
import { Layout, Footer } from '../ui/Layout';
import { AuditChrome } from '../ui/AuditChrome';
import { AuditAside } from '../ui/AuditAside';
import { CategoryDot, ResultPanel } from '../ui/ResultPanel';
import { CATEGORY_COLOR, categoryOf } from '../ui/findingView';
import { useAuditSession } from '../audit/useAuditSession';
import { applyChange, segmentText } from '../lib/highlight';
import { scrollToId } from '../lib/scroll';
import { fetchLandingText, PROXY_URL } from '../prepare/landing';
import { toast } from '../lib/toast';
import { t, fmt } from '../i18n';

const emptyText = (): TextInput => ({ script: '', caption: '', cta: '', landingUrl: '', landing: '' });

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function TextAudit() {
  const s = useAuditSession<TextInput>('text', emptyText);
  const [editing, setEditing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const showForm = !s.result || editing;
  const changed = !s.audit || JSON.stringify(s.input) !== JSON.stringify(s.audit.input);
  const hasContent = [s.input.script, s.input.caption, s.input.cta, s.input.landing].some((v) => v.trim());
  const hasExtra = !!(s.input.caption || s.input.cta || s.input.landing || s.input.landingUrl);
  const showMore = moreOpen || hasExtra;
  const active = s.result ? s.result.findings.filter((f) => !s.review.applied.has(f.id) && !s.review.dismissed.has(f.id)) : [];

  const run = () => {
    if (!hasContent || s.busy) return;
    setEditing(false);
    void s.run({ inputChanged: changed });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  };

  const fieldOf = (f: Finding): TextField | undefined => (f.location.kind === 'text' ? f.location.field : undefined);
  const apply = (f: Finding) => {
    const field = fieldOf(f);
    if (!field || !f.change || f.location.kind !== 'text') return;
    const quote = f.location.quote;
    const to = f.change.to;
    s.reviewActions.applyField(f, field, (v) => applyChange(v, quote, to));
  };
  const undo = (f: Finding) => {
    const field = fieldOf(f);
    if (field) s.reviewActions.undoField(f, field);
  };

  // Pick from text: scroll the panel to the finding. Pick from panel: scroll the text to that part.
  const pickFromText = (id: string | null) => {
    s.reviewActions.select(id);
    if (id) scrollToId(`row-${id}`);
  };
  const pickFromPanel = (id: string | null) => {
    s.reviewActions.select(id);
    if (id) scrollToId(`seg-${id}`);
  };

  const copyRevised = async () => {
    const parts = [
      s.input.script,
      s.input.caption && `Caption: ${s.input.caption}`,
      s.input.cta && `CTA: ${s.input.cta}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      toast(t.audit.copied);
    } catch {
      toast(t.audit.copyFailed, { tone: 'error' });
    }
  };

  const set = (k: keyof TextInput, v: string) => s.setInput((i) => ({ ...i, [k]: v }));

  const [fetching, setFetching] = useState(false);
  const fetchLanding = async () => {
    setFetching(true);
    s.setError(null);
    try {
      const { text } = await fetchLandingText(s.input.landingUrl);
      set('landing', text);
    } catch (e) {
      s.setError(fmt(t.text.fetchFailed, { error: (e as Error).message }));
    } finally {
      setFetching(false);
    }
  };

  return (
    <Layout section="audit">
      <AuditChrome
        mode="text"
        title={s.title}
        onTitle={(v) => void s.saveMeta({ title: v })}
        campaign={s.campaign}
        onCampaign={(c) => void s.saveMeta({ campaign: c })}
        hasResult={!!s.result}
        busy={s.busy}
        error={s.error}
        canRun={hasContent}
        onRun={run}
        onNew={() => {
          setEditing(false);
          s.startNew();
        }}
        extraActions={
          s.result && !s.busy ? (
            <button type="button" className="btn" onClick={() => setEditing((v) => !v)}>
              {editing ? t.campaign.close : t.audit.edit}
            </button>
          ) : undefined
        }
      />

      {s.notFound && <p className="px-6 py-6">{t.audit.notFound}</p>}
      {s.loading && <p className="px-6 py-6 text-muted">{t.audit.loading}</p>}

      {!s.loading && !s.notFound && (
        <div className="flex min-h-0 flex-1 flex-wrap">
          <main className="min-w-0 flex-[999_1_560px] p-4 sm:p-6">
            {showForm ? (
              <fieldset disabled={s.busy} className="panel m-0 min-w-0 max-w-[760px] p-0 disabled:opacity-70" onKeyDown={onKey}>
                <label className="block px-5 pb-3 pt-4">
                  <span className="mb-1.5 flex items-baseline justify-between">
                    <span className="font-semibold">{t.text.script}</span>
                    {s.input.script && <span className="text-[13px] text-muted">{fmt(t.text.words, { n: wordCount(s.input.script) })}</span>}
                  </span>
                  <textarea
                    className="field min-h-[180px] text-[15px] leading-relaxed"
                    rows={8}
                    value={s.input.script}
                    placeholder={t.text.scriptPlaceholder}
                    onChange={(e) => set('script', e.target.value)}
                    autoFocus={!s.input.script}
                  />
                </label>

                {showMore ? (
                  <div className="border-t border-line-2">
                    <label className="block px-5 py-3">
                      <span className="mb-1.5 block font-semibold">{t.text.caption}</span>
                      <textarea className="field" rows={2} value={s.input.caption} onChange={(e) => set('caption', e.target.value)} />
                    </label>
                    <label className="block px-5 py-3">
                      <span className="mb-1.5 block font-semibold">{t.text.cta}</span>
                      <input className="field" value={s.input.cta} onChange={(e) => set('cta', e.target.value)} />
                    </label>
                    <div className="px-5 pb-4 pt-3">
                      <label className="block" htmlFor="landing-url">
                        <span className="mb-1.5 block font-semibold">{t.text.landingUrl}</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="landing-url"
                          className="field min-w-0 flex-1"
                          type="url"
                          inputMode="url"
                          value={s.input.landingUrl}
                          onChange={(e) => set('landingUrl', e.target.value)}
                          placeholder="https://"
                        />
                        {PROXY_URL && (
                          <button type="button" className="btn" disabled={fetching || !/^https?:\/\/\S+\.\S+/.test(s.input.landingUrl)} onClick={() => void fetchLanding()}>
                            {fetching ? t.text.fetching : t.text.fetch}
                          </button>
                        )}
                      </div>
                      <label className="mt-3 block">
                        <span className="mb-1.5 block font-semibold">{t.text.landing}</span>
                        <textarea className="field" rows={4} value={s.input.landing} placeholder={t.text.landingPlaceholder} onChange={(e) => set('landing', e.target.value)} />
                      </label>

                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className="flex w-full cursor-pointer items-center gap-2 border-0 border-t border-line-2 bg-transparent px-5 py-3.5 text-left hover:bg-hover"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {t.text.more}
                  </button>
                )}
              </fieldset>
            ) : (
              <>
                {s.review.applied.size > 0 && (
                  <div role="status" className="mb-3 flex max-w-[760px] flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-line bg-panel px-4 py-2.5 text-[13px]">
                    <span className="flex-1">{fmt(t.audit.appliedNote, { n: s.review.applied.size })}</span>
                    <button type="button" className="link-btn font-semibold" onClick={() => void copyRevised()}>
                      {t.audit.copyRevised}
                    </button>
                    <button type="button" className="link-btn font-semibold" onClick={run} disabled={s.busy}>
                      {t.audit.rerun}
                    </button>
                  </div>
                )}
                <div className="panel max-w-[760px]">
                  {s.input.script && (
                    <p className="m-0 whitespace-pre-wrap px-5 py-6 text-lg leading-[1.85] sm:px-8">
                      <Highlighted text={s.input.script} field="script" findings={active} selected={s.review.selected} onPick={pickFromText} />
                    </p>
                  )}
                  <div className="grid grid-cols-[110px_1fr] border-t border-line text-sm">
                    {(['caption', 'cta', 'landing'] as const)
                      .filter((k) => s.input[k] || (k === 'landing' && s.input.landingUrl))
                      .map((k) => (
                        <div key={k} className="contents">
                          <div className="border-b border-line-2 px-5 py-3 text-muted">{t.text.fieldLabel[k]}</div>
                          <div className="min-w-0 whitespace-pre-wrap border-b border-line-2 px-5 py-3">
                            {k === 'landing' && s.input.landingUrl && <div className="mb-1 break-all text-muted">{s.input.landingUrl}</div>}
                            <Highlighted text={s.input[k]} field={k} findings={active} selected={s.review.selected} onPick={pickFromText} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="mt-3 flex max-w-[760px] justify-end">
                  {s.review.applied.size === 0 && (
                    <button type="button" className="link-btn text-[13px] text-muted" onClick={() => void copyRevised()}>
                      {t.audit.copyRevised}
                    </button>
                  )}
                </div>
              </>
            )}
            {!s.result && (
              <div className="max-w-[760px]">
                <Footer />
              </div>
            )}
          </main>

          {s.result && !s.busy ? (
            <ResultPanel
              result={s.result}
              review={s.review}
              onSelect={pickFromPanel}
              onApply={apply}
              onUndo={undo}
              onDismiss={s.reviewActions.dismiss}
              onRestore={s.reviewActions.restore}
              marker={(f) => <CategoryDot f={f} />}
            />
          ) : (
            <AuditAside busy={s.busy} stage={s.stage} startedAt={s.startedAt} onCancel={s.cancel} />
          )}
        </div>
      )}
    </Layout>
  );
}

function Highlighted({
  text,
  field,
  findings,
  selected,
  onPick,
}: {
  text: string;
  field: TextField;
  findings: Finding[];
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <>
      {segmentText(text, findings, field).map((seg, i) =>
        seg.finding ? (
          <button
            key={i}
            id={`seg-${seg.finding.id}`}
            type="button"
            onClick={() => onPick(selected === seg.finding!.id ? null : seg.finding!.id)}
            aria-pressed={selected === seg.finding.id}
            className="m-0 inline cursor-pointer scroll-mt-24 whitespace-pre-wrap rounded-[2px] border-0 p-0 text-left underline decoration-2 underline-offset-[5px] hover:bg-select"
            style={{
              textDecorationColor: CATEGORY_COLOR[categoryOf(seg.finding)],
              background: selected === seg.finding.id ? 'var(--color-select)' : undefined,
              lineHeight: 'inherit',
            }}
          >
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
