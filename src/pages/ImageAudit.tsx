import { useMemo, useState } from 'react';
import type { Finding, ImageInput } from '../types';
import { Layout, Footer } from '../ui/Layout';
import { AuditChrome } from '../ui/AuditChrome';
import { AuditAside } from '../ui/AuditAside';
import { NumberBadge, ResultPanel } from '../ui/ResultPanel';
import { Dropzone, FileButton } from '../ui/Dropzone';
import { severityOf, sortFindings } from '../ui/findingView';
import { useAuditSession } from '../audit/useAuditSession';
import { useObjectUrls } from '../lib/useObjectUrls';
import { applyChange } from '../lib/highlight';
import { scrollToId } from '../lib/scroll';
import { MAX_SLIDES, prepareImage } from '../prepare/media';
import { t, fmt } from '../i18n';

const emptyImage = (): ImageInput => ({ slides: [], caption: '' });

const slideSig = (i: ImageInput) => i.slides.map((s) => `${s.name}:${s.blob.size}`).join('|');

export function ImageAudit() {
  const s = useAuditSession<ImageInput>('image', emptyImage);
  const [slide, setSlide] = useState(0);
  const [preparing, setPreparing] = useState(false);

  const blobs = useMemo(() => s.input.slides.map((x) => x.blob), [s.input.slides]);
  const urls = useObjectUrls(blobs);
  const sorted = useMemo(() => (s.result ? sortFindings(s.result.findings) : []), [s.result]);
  const numberOf = (f: Finding) => sorted.indexOf(f) + 1;
  const active = sorted.filter((f) => !s.review.applied.has(f.id) && !s.review.dismissed.has(f.id));
  const current = Math.min(slide, Math.max(0, s.input.slides.length - 1));
  const pins = active.filter((f) => f.location.kind === 'image' && f.location.slide === current + 1);
  const hasKnockout = active.some((f) => severityOf(f) === 'knockout');
  const prev = s.audit?.input as ImageInput | undefined;
  const changed = !prev || slideSig(prev) !== slideSig(s.input) || prev.caption !== s.input.caption;

  const addFiles = async (files: File[], replace: boolean) => {
    s.setError(null);
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const room = replace ? MAX_SLIDES : MAX_SLIDES - s.input.slides.length;
    if (imgs.length > room) s.setError(fmt(t.image.tooMany, { max: MAX_SLIDES }));
    if (!imgs.length || room <= 0) return;
    setPreparing(true);
    try {
      const prepared = await Promise.all(imgs.slice(0, room).map(prepareImage));
      s.setInput((i) => ({ ...i, slides: replace ? prepared : [...i.slides, ...prepared] }));
      setSlide(replace ? 0 : s.input.slides.length);
    } catch (e) {
      s.setError((e as Error).message);
    } finally {
      setPreparing(false);
    }
  };

  const removeSlide = (n: number) => {
    s.setInput((i) => ({ ...i, slides: i.slides.filter((_, k) => k !== n) }));
    setSlide((v) => Math.max(0, v > n ? v - 1 : v));
  };

  const select = (id: string | null, from: 'panel' | 'image') => {
    s.reviewActions.select(id);
    const f = sorted.find((x) => x.id === id);
    if (f?.location.kind === 'image') setSlide(f.location.slide - 1);
    if (id && from === 'image') scrollToId(`row-${id}`);
  };

  const applyCaption = (f: Finding) => {
    if (f.location.kind !== 'text' || !f.change) return;
    const { quote } = f.location;
    const to = f.change.to;
    s.reviewActions.applyField(f, 'caption', (v) => applyChange(v, quote, to));
  };

  const run = () => void s.run({ inputChanged: changed });
  const slideData = s.input.slides[current];

  return (
    <Layout section="audit">
      <AuditChrome
        mode="image"
        title={s.title}
        onTitle={(v) => void s.saveMeta({ title: v })}
        campaign={s.campaign}
        onCampaign={(c) => void s.saveMeta({ campaign: c })}
        hasResult={!!s.result}
        busy={s.busy}
        error={s.error}
        canRun={s.input.slides.length > 0 && !preparing}
        onRun={run}
        onNew={s.startNew}
        extraActions={
          s.input.slides.length > 0 && !s.busy ? (
            <FileButton accept="image/*" multiple label={t.image.replace} onFiles={(f) => void addFiles(f, true)} disabled={preparing} />
          ) : undefined
        }
      />

      {s.notFound && <p className="px-6 py-6">{t.audit.notFound}</p>}

      {!s.loading && !s.notFound && (
        <div className="flex min-h-0 flex-1 flex-wrap">
          <main className="flex min-w-0 flex-[999_1_560px] flex-wrap items-start gap-5 p-4 sm:p-6">
            {s.input.slides.length === 0 ? (
              <Dropzone
                accept="image/*"
                multiple
                onFiles={(f) => void addFiles(f, true)}
                title={t.image.drop}
                help={fmt(t.image.help, { max: MAX_SLIDES })}
                button={t.image.upload}
                busy={preparing ? t.image.preparing : null}
              />
            ) : (
              <>
                <div className="flex flex-row flex-wrap gap-2 sm:flex-col">
                  <div className="w-full text-[13px] text-muted">{fmt(t.image.slides, { n: s.input.slides.length })}</div>
                  {s.input.slides.map((sl, i) => {
                    const c = active.filter((f) => f.location.kind === 'image' && f.location.slide === i + 1).length;
                    return (
                      <div key={`${sl.name}-${i}`} className="group relative flex flex-col">
                        <button
                          type="button"
                          onClick={() => setSlide(i)}
                          aria-label={fmt(t.image.slide, { n: i + 1 })}
                          aria-pressed={current === i}
                          className="h-[100px] w-20 cursor-pointer overflow-hidden bg-line-2 p-0"
                          style={{ border: current === i ? '2px solid var(--color-ink)' : '1px solid var(--color-line)' }}
                        >
                          {urls[i] && <img src={urls[i]} alt="" className="size-full object-cover" />}
                        </button>
                        {!s.result && (
                          <button
                            type="button"
                            onClick={() => removeSlide(i)}
                            aria-label={fmt(t.image.removeSlide, { n: i + 1 })}
                            className="absolute right-1 top-1 flex size-6 cursor-pointer items-center justify-center border-0 bg-ink/80 text-white opacity-100 hover:bg-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                          >
                            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                        <span className="mt-0.5 text-xs text-muted">
                          {s.result ? `${fmt(t.image.slide, { n: i + 1 })} · ${c === 0 ? t.image.safe : fmt(t.image.count, { n: c })}` : fmt(t.image.slide, { n: i + 1 })}
                        </span>
                      </div>
                    );
                  })}
                  {!s.result && s.input.slides.length < MAX_SLIDES && (
                    <FileButton accept="image/*" multiple label={t.image.add} onFiles={(f) => void addFiles(f, false)} disabled={preparing} />
                  )}
                </div>

                <div className="min-w-0 flex-[1_1_380px]">
                  <div className="flex justify-center rounded-[4px] border border-line bg-[#ededef] px-4 py-8">
                    {slideData && (
                      <div className="relative max-w-full" style={{ width: Math.min(420, slideData.width), aspectRatio: `${slideData.width} / ${slideData.height}` }}>
                        {urls[current] && <img src={urls[current]} alt={fmt(t.image.slide, { n: current + 1 })} className="block size-full" />}
                        {pins.map((f) => {
                          if (f.location.kind !== 'image') return null;
                          const [x, y, w, h] = f.location.box;
                          const on = s.review.selected === f.id;
                          return (
                            <div key={f.id}>
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute"
                                style={{
                                  left: `${x * 100}%`,
                                  top: `${y * 100}%`,
                                  width: `${w * 100}%`,
                                  height: `${h * 100}%`,
                                  outline: `2px solid ${on ? 'var(--color-primary)' : '#fff'}`,
                                  boxShadow: '0 0 0 1px rgba(22,24,35,0.6)',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => select(on ? null : f.id, 'image')}
                                aria-label={`Finding ${numberOf(f)}`}
                                className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center border-2 border-white text-[13px] font-bold text-white"
                                style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: on ? 'var(--color-primary)' : 'var(--color-ink)' }}
                              >
                                {numberOf(f)}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <label className="panel mt-4 block px-5 py-4">
                    <span className="mb-1.5 block font-semibold">{t.image.caption}</span>
                    <textarea className="field disabled:opacity-70" disabled={s.busy} rows={3} value={s.input.caption} onChange={(e) => s.setInput((i) => ({ ...i, caption: e.target.value }))} />
                  </label>
                </div>
              </>
            )}
            {!s.result && (
              <div className="w-full max-w-[760px]">
                <Footer />
              </div>
            )}
          </main>

          {s.result && !s.busy ? (
            <ResultPanel
              result={s.result}
              review={s.review}
              onSelect={(id) => select(id, 'panel')}
              onApply={applyCaption}
              onUndo={(f) => s.reviewActions.undoField(f, 'caption')}
              onDismiss={s.reviewActions.dismiss}
              onRestore={s.reviewActions.restore}
              markerWidth={22}
              marker={(f) => <NumberBadge n={numberOf(f)} active={s.review.selected === f.id} />}
              footer={hasKnockout ? <OrganicNote /> : undefined}
            />
          ) : (
            <AuditAside busy={s.busy} stage={s.stage} startedAt={s.startedAt} onCancel={s.cancel} />
          )}
        </div>
      )}
    </Layout>
  );
}

export function OrganicNote() {
  return (
    <p className="m-0 border-t border-line px-6 py-3 text-[13px] text-ink-2">{t.result.organic}</p>
  );
}
