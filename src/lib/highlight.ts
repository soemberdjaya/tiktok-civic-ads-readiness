import type { Finding, TextField } from '../types';

export interface Segment {
  text: string;
  finding?: Finding;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regex that matches a quote even if its spaces or line breaks differ. */
export function quoteRegex(quote: string): RegExp {
  return new RegExp(quote.trim().split(/\s+/).map(escape).join('\\s+'));
}

/** Split text into plain and flagged segments. Overlapping ranges are skipped. */
export function segmentText(text: string, findings: Finding[], field: TextField): Segment[] {
  const ranges: { start: number; end: number; finding: Finding }[] = [];
  for (const f of findings) {
    if (f.location.kind !== 'text' || f.location.field !== field) continue;
    const m = quoteRegex(f.location.quote).exec(text);
    if (!m) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, finding: f });
  }
  ranges.sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) });
    out.push({ text: text.slice(r.start, r.end), finding: r.finding });
    pos = r.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

/** Replace a quote with the suggestion. Empty suggestion = delete, then tidy double spaces. */
export function applyChange(text: string, quote: string, to: string): string {
  const next = text.replace(quoteRegex(quote), to);
  return to ? next : next.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?;:])/g, '$1').trim();
}
