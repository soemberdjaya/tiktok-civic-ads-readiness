import type { Band, Finding } from '../types';
import { KEY_MAP, KNOCKOUT_CONFIDENCE, type Category } from '../scoring/keys';
import { library, type ClauseRef, type RuleFile } from '../rules/library';
import { formatTime } from '../prepare/media';
import { t, fmt } from '../i18n';

export const CATEGORY_COLOR: Record<Category, string> = {
  policy: 'var(--color-cat-policy)',
  landing: 'var(--color-cat-landing)',
  law: 'var(--color-cat-law)',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  policy: 'Content policy',
  landing: 'Landing page',
  law: 'Indonesian law',
};

export const BAND_COLOR: Record<Band, string> = {
  blocked: 'var(--color-blocked)',
  high: 'var(--color-bad)',
  med: 'var(--color-warn)',
  low: 'var(--color-ok)',
};

export type Severity = 'knockout' | 'high' | 'med' | 'low' | 'law';

export function severityOf(f: Finding): Severity {
  const def = KEY_MAP[f.key];
  if (!def) return 'low';
  if (def.kind === 'law') return 'law';
  if (def.kind === 'knockout') return f.confidence >= KNOCKOUT_CONFIDENCE ? 'knockout' : 'high';
  const impact = (def.weight ?? 0) * f.confidence;
  return impact >= 15 ? 'high' : impact >= 7 ? 'med' : 'low';
}

const SEV_ORDER: Record<Severity, number> = { knockout: 0, high: 1, med: 2, low: 3, law: 4 };

export function sortFindings(fs: Finding[]): Finding[] {
  return [...fs].sort((a, b) => SEV_ORDER[severityOf(a)] - SEV_ORDER[severityOf(b)] || b.confidence - a.confidence);
}

export function categoryOf(f: Finding): Category {
  return KEY_MAP[f.key]?.category ?? 'policy';
}

export function whereLabel(f: Finding): string {
  const l = f.location;
  if (l.kind === 'text') {
    // A short quote tells apart two findings with the same key.
    const q = l.quote.length > 42 ? l.quote.slice(0, 40).trimEnd() + '…' : l.quote;
    return `${l.field ? t.text.fieldLabel[l.field] : 'Text'} · “${q}”`;
  }
  if (l.kind === 'image') return fmt(t.image.slide, { n: l.slide });
  if (l.kind === 'campaign') return t.campaign.title;
  return `${formatTime(l.start)}–${formatTime(l.end)} · ${t.video.track[l.track]}`;
}

export function clauseOf(f: Finding): ClauseRef | undefined {
  return library.clauses.get(f.clause);
}

/** Reference numbers per source document, in order of first appearance. */
export function referenceList(fs: Finding[]): { file: RuleFile; n: number }[] {
  const out: { file: RuleFile; n: number }[] = [];
  for (const f of fs) {
    const c = clauseOf(f);
    if (c && !out.some((r) => r.file.id === c.file.id)) out.push({ file: c.file, n: out.length + 1 });
  }
  return out;
}
