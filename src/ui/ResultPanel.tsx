import { useMemo, useState, type ReactNode } from 'react';
import type { AuditResult, Finding } from '../types';
import { scoreFindings } from '../scoring/score';
import { Link } from '../lib/router';
import { KEY_MAP, type Category } from '../scoring/keys';
import { t, fmt } from '../i18n';
import {
  BAND_COLOR,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  categoryOf,
  clauseOf,
  referenceList,
  severityOf,
  sortFindings,
  whereLabel,
} from './findingView';

export interface ReviewState {
  selected: string | null;
  applied: Set<string>;
  dismissed: Set<string>;
}

interface Props {
  result: AuditResult;
  review: ReviewState;
  onSelect: (id: string | null) => void;
  /** Absent = this finding can't be applied automatically (e.g. images). */
  onApply?: (f: Finding) => void;
  onUndo?: (f: Finding) => void;
  onDismiss: (f: Finding) => void;
  onRestore: () => void;
  /** First column of a finding row: category dot, marker number, or time. */
  marker: (f: Finding, index: number) => ReactNode;
  markerWidth?: number;
  footer?: ReactNode;
}

type Tab = 'all' | Category;

export function ResultPanel({ result, review, onSelect, onApply, onUndo, onDismiss, onRestore, marker, markerWidth = 10, footer }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const [showDiscarded, setShowDiscarded] = useState(false);
  const all = useMemo(() => sortFindings(result.findings), [result.findings]);
  const active = all.filter((f) => !review.applied.has(f.id) && !review.dismissed.has(f.id));
  const changed = review.applied.size > 0 || review.dismissed.size > 0;
  const live = changed ? scoreFindings(active) : { score: result.score, band: result.band, knockouts: [] as Finding[] };
  const knockouts = active.filter((f) => severityOf(f) === 'knockout').length;
  const lostCore = all.filter((f) => review.applied.has(f.id) && f.removesCoreMessage);
  const rows = active.filter((f) => tab === 'all' || categoryOf(f) === tab);
  const refs = referenceList(all);
  // After applying or dismissing, open the next active finding so review keeps flowing.
  const advance = (f: Finding) => {
    const rest = active.filter((x) => x.id !== f.id);
    const after = rest.find((x) => all.indexOf(x) > all.indexOf(f)) ?? rest[0];
    if (after) setTimeout(() => onSelect(after.id), 0);
  };
  const refNo = (f: Finding) => refs.find((r) => r.file.id === clauseOf(f)?.file.id)?.n;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: t.result.tabs.all },
    { id: 'policy', label: t.result.tabs.policy },
    { id: 'landing', label: t.result.tabs.landing },
    { id: 'law', label: t.result.tabs.law },
  ];
  const count = (id: Tab) => active.filter((f) => id === 'all' || categoryOf(f) === id).length;

  const note = changed
    ? t.result.estimate
    : knockouts
      ? fmt(t.result.knockoutNote, { n: knockouts })
      : active.length
        ? fmt(t.result.countNote, { n: active.length })
        : t.result.noneNote;

  return (
    <aside aria-label="Audit result" className="flex min-w-0 flex-[1_1_400px] flex-col border-line bg-panel lg:border-l">
      <div className="px-6 pb-4 pt-5">
        <div className="text-[13px] text-muted">{t.result.statusFor}</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-lg font-bold" role="status">
            <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: BAND_COLOR[live.band] }} />
            {t.result.band[live.band]}
          </span>
          {/* The score is meaningless with a hard violation, so it isn't shown. */}
          {live.band !== 'blocked' && (
            <span>
              <span className="font-bold">{live.score}</span>
              <span className="text-muted">/100</span>
            </span>
          )}
        </div>
        {live.band !== 'blocked' && (
          <div aria-hidden="true" className="mt-2.5 h-1 bg-line-2">
            <div className="h-1" style={{ width: `${live.score}%`, background: BAND_COLOR[live.band] }} />
          </div>
        )}
        <div className="mt-2 text-[13px] text-muted">{note}</div>
      </div>

      {lostCore.length > 0 && (
        <div role="status" className="mx-6 mb-3 rounded-[4px] border border-notice-line bg-notice px-3.5 py-3 text-[13px]">
          {t.result.coreLost}
          <button type="button" className="link-btn mt-1.5 block font-semibold" onClick={() => lostCore.forEach((f) => onUndo?.(f))}>
            {t.result.undo}
          </button>
        </div>
      )}

      <div role="tablist" aria-label={t.result.tabs.label} className="flex gap-5 overflow-x-auto border-b border-line px-6">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={
              'cursor-pointer whitespace-nowrap border-0 bg-transparent py-2.5 ' +
              (tab === tb.id ? 'font-semibold shadow-[inset_0_-2px_0_var(--color-ink)]' : 'text-muted')
            }
          >
            {tb.label} {count(tb.id)}
          </button>
        ))}
      </div>

      <div>
        {rows.map((f) => {
          const open = review.selected === f.id;
          const sev = severityOf(f);
          const clause = clauseOf(f);
          const def = KEY_MAP[f.key];
          const n = refNo(f);
          return (
            <div key={f.id} id={`row-${f.id}`} className={'scroll-mt-20 border-b border-line-2 ' + (open ? 'bg-hover' : '')}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onSelect(open ? null : f.id)}
                className="grid w-full cursor-pointer items-baseline gap-3 border-0 bg-transparent px-6 py-3.5 text-left"
                style={{ gridTemplateColumns: `${markerWidth}px 1fr auto` }}
              >
                {marker(f, all.indexOf(f))}
                <span>
                  <span className="font-semibold">{def?.label ?? f.key}</span>
                  <span className="block text-[13px] text-muted">
                    {CATEGORY_LABEL[categoryOf(f)]} · {whereLabel(f)}
                  </span>
                </span>
                <span className={'text-[13px] ' + (sev === 'knockout' ? 'font-bold' : 'text-muted')}>{t.result.sev[sev]}</span>
              </button>
              {open && (
                <div className="pb-4.5 pr-6 text-sm" style={{ paddingLeft: 24 + markerWidth + 12 }}>
                  <p className="m-0">{f.why}</p>
                  {f.evidence && f.location.kind !== 'text' && <p className="m-0 mt-1.5 text-[13px] text-muted">{f.evidence}</p>}
                  {f.change && (
                    <>
                      <div className="mt-3 text-[13px] text-muted">{t.result.change}</div>
                      <div className="mt-0.5 text-muted line-through">{f.change.from}</div>
                      <div className="font-semibold">{f.change.to || t.result.remove}</div>
                      {f.changeRejected && <div className="mt-1 text-[13px] text-muted">{t.result.disguiseRejected}</div>}
                    </>
                  )}
                  {clause && (
                    <>
                      <div className="mt-3 text-[13px] text-muted">
                        {t.result.basis}{' '}
                        <a href={`#ref-${n}`} className="text-muted">
                          [{n}]
                        </a>
                        {' · '}
                        {clause.kind === 'quote' ? t.result.quoteLabel : t.result.summaryLabel}
                      </div>
                      <div className="mt-0.5">{clause.kind === 'quote' ? `“${clause.text}”` : clause.text}</div>
                    </>
                  )}
                  {f.source === 'lexicon' && <div className="mt-2 text-[13px] text-muted">{t.result.lexiconSource}</div>}
                  <div className="mt-3.5 flex items-center gap-4">
                    {onApply && f.change && f.location.kind === 'text' && (
                      <button type="button" className="btn btn-dark" onClick={() => {
                          onApply(f);
                          advance(f);
                        }}>
                        {t.result.apply}
                      </button>
                    )}
                    <button type="button" className="link-btn text-muted" onClick={() => {
                        onDismiss(f);
                        advance(f);
                      }}>
                      {t.result.dismiss}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="m-0 px-6 py-5 text-muted">{t.result.emptyTab}</p>}
        {review.dismissed.size > 0 && (
          <button type="button" className="link-btn mx-6 my-3 text-[13px] text-muted" onClick={onRestore}>
            {t.result.restore}
          </button>
        )}
      </div>

      {footer}

      <div className="mt-auto border-t border-line px-6 pb-5 pt-4 text-[13px]">
        <div className="font-semibold">{t.result.references}</div>
        {refs.length > 0 && (
          <ol className="mb-0 mt-1.5 flex list-decimal flex-col gap-1 pl-5.5 text-ink-2">
            {refs.map((r) => (
              <li key={r.file.id} id={`ref-${r.n}`}>
                <a href={r.file.url} target="_blank" rel="noreferrer noopener">
                  {r.file.title}
                </a>
                {r.file.source_updated ? `, diperbarui ${r.file.source_updated}` : ''}.
              </li>
            ))}
          </ol>
        )}
        <p className="mb-0 mt-2.5 text-muted">
          {fmt(t.result.rulesVersion, { v: result.rulesVersion, model: result.model })}. {t.app.footer}{' '}
          <Link to="/privacy" className="text-muted">
            {t.app.privacy}
          </Link>
        </p>
        {result.discarded.length > 0 && (
          <div className="mt-2 text-muted">
            {fmt(t.result.discarded, { n: result.discarded.length })}{' '}
            <button type="button" className="link-btn text-muted" onClick={() => setShowDiscarded((v) => !v)}>
              {t.result.discardedDetail}
            </button>
            {showDiscarded && (
              <ul className="mb-0 mt-1 pl-5">
                {result.discarded.map((d, i) => (
                  <li key={i}>{d.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

export function CategoryDot({ f }: { f: Finding }) {
  return <span aria-hidden="true" className="inline-block size-2" style={{ background: CATEGORY_COLOR[categoryOf(f)] }} />;
}

export function NumberBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <span
      className="inline-flex size-[22px] items-center justify-center text-xs font-bold text-white"
      style={{ background: active ? 'var(--color-primary)' : 'var(--color-ink)' }}
    >
      {n}
    </span>
  );
}
