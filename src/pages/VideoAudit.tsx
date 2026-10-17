import { useEffect, useMemo, useRef, useState } from 'react';
import type { Finding, VideoInput } from '../types';
import { Layout, Footer } from '../ui/Layout';
import { AuditChrome } from '../ui/AuditChrome';
import { AuditAside } from '../ui/AuditAside';
import { ResultPanel } from '../ui/ResultPanel';
import { Dropzone, FileButton } from '../ui/Dropzone';
import { OrganicNote } from './ImageAudit';
import { severityOf, sortFindings } from '../ui/findingView';
import { useAuditSession } from '../audit/useAuditSession';
import { useObjectUrls } from '../lib/useObjectUrls';
import { useSettings } from '../lib/settings';
import { applyChange } from '../lib/highlight';
import { extractFrames, formatTime, MAX_NATIVE_VIDEO_BYTES, MAX_VIDEO_SECONDS, parseSubtitles } from '../prepare/media';
import { t, fmt } from '../i18n';

const emptyVideo = (): VideoInput => ({ name: '', duration: 0, frames: [], transcript: [], caption: '', width: 0, height: 0 });

const TRACKS = [
  { id: 'onscreen_text', label: t.video.onscreen },
  { id: 'audio', label: t.video.audio },
] as const;

export function VideoAudit() {
  const s = useAuditSession<VideoInput>('video', emptyVideo);
  const { provider } = useSettings();
  const file = s.media ?? null;
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [time, setTime] = useState(0);
  const videoEl = useRef<HTMLVideoElement>(null);

  const v = s.input;
  const dur = v.duration || 1;
  const fileUrls = useObjectUrls(useMemo(() => (file ? [file] : []), [file]));
  // The frame strip is capped at 12 tiles to stay readable.
  const strip = useMemo(() => {
    if (!v.frames.length) return [];
    const step = Math.max(1, Math.ceil(v.frames.length / 12));
    return v.frames.filter((_, i) => i % step === 0);
  }, [v.frames]);
  const stripUrls = useObjectUrls(useMemo(() => strip.map((f) => f.blob), [strip]));
  const frameAt = v.frames.length ? v.frames[Math.min(v.frames.length - 1, Math.floor(time))] : undefined;
  const frameUrls = useObjectUrls(useMemo(() => (frameAt && !file ? [frameAt.blob] : []), [frameAt, file]));

  const sorted = useMemo(() => (s.result ? sortFindings(s.result.findings) : []), [s.result]);
  const active = sorted.filter((f) => !s.review.applied.has(f.id) && !s.review.dismissed.has(f.id));
  const timed = active.filter((f) => f.location.kind === 'video');
  const selected = sorted.find((f) => f.id === s.review.selected);
  const hasKnockout = active.some((f) => severityOf(f) === 'knockout');
  const prev = s.audit?.input as VideoInput | undefined;
  const changed =
    !prev || prev.name !== v.name || prev.duration !== v.duration || prev.caption !== v.caption || JSON.stringify(prev.transcript) !== JSON.stringify(v.transcript);
  const native = provider.capabilities.video === 'native' && !!file && file.size <= MAX_NATIVE_VIDEO_BYTES;

  useEffect(() => {
    if (selected?.location.kind === 'video') seek(selected.location.start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  function seek(sec: number) {
    setTime(sec);
    if (videoEl.current) videoEl.current.currentTime = sec;
  }

  const pickVideo = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith('video/')) ?? files[0];
    if (!f) return;
    s.setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      const out = await extractFrames(f, (done, total) => setProgress({ done, total }));
      s.setMedia(f);
      s.setInput((i) => ({ ...i, name: f.name, ...out }));
      setTime(0);
    } catch (e) {
      s.setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const pickSubtitle = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const transcript = parseSubtitles(await f.text());
    s.setInput((i) => ({ ...i, transcript }));
  };

  const pct = (sec: number) => `${Math.min(100, (sec / dur) * 100)}%`;
  const ticks = Array.from({ length: Math.floor(dur / 5) + 1 }, (_, i) => i * 5);

  return (
    <Layout section="audit">
      <AuditChrome
        mode="video"
        title={s.title}
        onTitle={(x) => void s.saveMeta({ title: x })}
        campaign={s.campaign}
        onCampaign={(c) => void s.saveMeta({ campaign: c })}
        hasResult={!!s.result}
        busy={s.busy}
        error={s.error}
        canRun={v.frames.length > 0 && !progress}
        onRun={() => void s.run({ inputChanged: changed })}
        onNew={s.startNew}
        extraActions={
          v.frames.length > 0 && !s.busy ? (
            <FileButton accept="video/*" label={t.video.replace} onFiles={(f) => void pickVideo(f)} disabled={!!progress} />
          ) : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-wrap">
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 p-4 sm:p-6">
          {!v.frames.length ? (
            <Dropzone
              accept="video/*"
              onFiles={(f) => void pickVideo(f)}
              title={t.video.drop}
              help={fmt(t.video.help, { max: MAX_VIDEO_SECONDS })}
              button={t.video.upload}
              busy={progress ? fmt(t.video.extracting, progress) : null}
            />
          ) : v.frames.length > 0 ? (
            <>
              <div className="flex flex-wrap items-start gap-5">
                <div className="relative h-[360px] max-w-full flex-none overflow-hidden bg-ink" style={{ aspectRatio: `${v.width || 9} / ${v.height || 16}` }}>
                  {file ? (
                    <video
                      ref={videoEl}
                      src={fileUrls[0]}
                      controls
                      playsInline
                      className="size-full object-contain"
                      onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                    />
                  ) : (
                    frameUrls[0] && <img src={frameUrls[0]} alt={`Frame ${formatTime(time)}`} className="size-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-[1_1_260px]">
                  <div className="panel">
                    <div className="border-b border-line px-4 py-3 text-[13px] text-muted">Frame {formatTime(time)}</div>
                    {selected && selected.location.kind === 'video' ? (
                      <dl className="m-0 grid grid-cols-[110px_1fr] text-sm">
                        <dt className="border-b border-line-2 px-4 py-2.5 text-muted">{t.video.source}</dt>
                        <dd className="m-0 border-b border-line-2 px-4 py-2.5">{t.video.track[selected.location.track]}</dd>
                        <dt className="border-b border-line-2 px-4 py-2.5 text-muted">{t.video.detected}</dt>
                        <dd className="m-0 border-b border-line-2 px-4 py-2.5">{selected.evidence || selected.why}</dd>
                        <dt className="px-4 py-2.5 text-muted">{t.video.range}</dt>
                        <dd className="m-0 px-4 py-2.5">
                          {formatTime(selected.location.start)}–{formatTime(selected.location.end)}
                        </dd>
                      </dl>
                    ) : (
                      <p className="m-0 px-4 py-3 text-[13px] text-muted">
                        {v.name} · {v.duration.toFixed(1)}s · {native ? 'video + audio' : `${v.frames.length} frames`}
                      </p>
                    )}
                  </div>
                  <div className="panel mt-4 px-4 py-3">
                    <FileButton accept=".srt,.vtt,text/vtt" label={t.video.subtitle} onFiles={(f) => void pickSubtitle(f)} />
                    <p className="mb-0 mt-2 text-[13px] text-muted">
                      {v.transcript.length ? fmt(t.video.subtitleLoaded, { n: v.transcript.length }) : t.video.subtitleHint}
                    </p>
                  </div>
                </div>
              </div>

              <section aria-label={t.video.timeline} className="panel">
                <div className="flex items-center gap-3 border-b border-line px-4 py-2">
                  <span className="font-semibold tabular-nums">{formatTime(time)}</span>
                  <span className="text-muted">/ {formatTime(v.duration)}</span>
                </div>
                <div className="flex overflow-x-auto px-4 pb-3 pt-2">
                  <div className="w-24 flex-none text-xs text-muted">
                    <div className="h-5" />
                    <div className="h-[26px] leading-[26px]">{t.video.findings}</div>
                    <div className="h-10 leading-10">{t.video.frames}</div>
                    {TRACKS.map((tr) => (
                      <div key={tr.id} className="h-7 leading-7">
                        {tr.label}
                      </div>
                    ))}
                  </div>
                  <div className="relative min-w-[420px] flex-1">
                    <div className="relative h-5 text-[11px] tabular-nums text-muted">
                      {ticks.map((sec) => (
                        <span key={sec} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: pct(sec) }}>
                          {formatTime(sec)}
                        </span>
                      ))}
                    </div>
                    <div className="relative h-[26px]">
                      {timed.map((f) => {
                        if (f.location.kind !== 'video') return null;
                        const on = s.review.selected === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => s.reviewActions.select(f.id)}
                            aria-label={`Jump to ${formatTime(f.location.start)}`}
                            className="absolute top-0.5 size-[22px] -translate-x-1/2 cursor-pointer border-0 text-xs font-bold text-white"
                            style={{ left: pct(f.location.start), background: on ? 'var(--color-primary)' : 'var(--color-ink)' }}
                          >
                            {sorted.indexOf(f) + 1}
                          </button>
                        );
                      })}
                    </div>
                    <div className="my-0.5 grid h-9 gap-px" style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}>
                      {strip.map((f, i) => (
                        <button key={f.t} type="button" onClick={() => seek(f.t)} aria-label={`Frame ${formatTime(f.t)}`} className="cursor-pointer overflow-hidden border-0 bg-line-2 p-0">
                          {stripUrls[i] && <img src={stripUrls[i]} alt="" className="size-full object-cover" />}
                        </button>
                      ))}
                    </div>
                    {TRACKS.map((tr) => (
                      <div key={tr.id} className="relative h-7 border-t border-line-2">
                        {tr.id === 'audio' &&
                          v.transcript.map((seg, i) => (
                            <span
                              key={i}
                              className="absolute top-1 box-border h-5 overflow-hidden whitespace-nowrap bg-line-2 px-1.5 text-[11px] leading-5"
                              style={{ left: pct(seg.start), width: pct(Math.max(0.5, seg.end - seg.start)) }}
                              title={seg.text}
                            >
                              {seg.text}
                            </span>
                          ))}
                        {timed
                          .filter((f) => f.location.kind === 'video' && f.location.track === tr.id)
                          .map((f) =>
                            f.location.kind === 'video' ? (
                              <span
                                key={f.id}
                                aria-hidden="true"
                                className="absolute top-1 box-border h-5 overflow-hidden whitespace-nowrap px-1.5 text-[11px] leading-5"
                                style={{
                                  left: pct(f.location.start),
                                  width: pct(Math.max(0.5, f.location.end - f.location.start)),
                                  boxShadow: 'inset 0 0 0 1px var(--color-ink)',
                                  background: 'rgba(240,240,242,0.9)',
                                }}
                              >
                                {f.evidence}
                              </span>
                            ) : null,
                          )}
                      </div>
                    ))}
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 top-5 w-px bg-primary" style={{ left: pct(time) }} />
                  </div>
                </div>
              </section>

              <label className="panel block px-5 py-4">
                <span className="mb-1.5 block font-semibold">{t.video.caption}</span>
                <textarea className="field disabled:opacity-70" disabled={s.busy} rows={3} value={v.caption} onChange={(e) => s.setInput((i) => ({ ...i, caption: e.target.value }))} />
              </label>
            </>
          ) : null}
          {!s.result && (
            <div className="w-full">
              <Footer />
            </div>
          )}
        </main>

        {s.result && !s.busy ? (
          <ResultPanel
            result={s.result}
            review={s.review}
            onSelect={s.reviewActions.select}
            onApply={(f: Finding) => {
              if (f.location.kind !== 'text' || !f.change) return;
              const { quote } = f.location;
              const to = f.change.to;
              s.reviewActions.applyField(f, 'caption', (c) => applyChange(c, quote, to));
            }}
            onUndo={(f) => s.reviewActions.undoField(f, 'caption')}
            onDismiss={s.reviewActions.dismiss}
            onRestore={s.reviewActions.restore}
            markerWidth={48}
            marker={(f) => (
              <span className="font-semibold tabular-nums">{f.location.kind === 'video' ? formatTime(f.location.start) : '—'}</span>
            )}
            footer={hasKnockout ? <OrganicNote /> : undefined}
          />
        ) : (
          <AuditAside busy={s.busy} stage={s.stage} startedAt={s.startedAt} onCancel={s.cancel} />
        )}
      </div>
    </Layout>
  );
}
