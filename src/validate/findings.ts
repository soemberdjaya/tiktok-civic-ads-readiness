import type { Campaign, Finding, FindingLocation, Mode, TextField } from '../types';
import { ModelFindingSchema, ModelOutputSchema, type ModelFinding } from '../prompt/schema';
import { KEY_MAP } from '../scoring/keys';
import type { ClauseRef } from '../rules/library';
import { findPoliticalNames, suggestionDisguises } from './lexicon';

export interface ValidationContext {
  mode: Mode;
  /** Quotable text per field. Images and videos also have a caption. */
  texts: Partial<Record<TextField, string>>;
  slideCount?: number;
  duration?: number;
  clauses: Map<string, ClauseRef>;
}

export interface Rejection {
  reason: string;
  raw: unknown;
  /** true = the model can be asked to fix it; false = dropped immediately. */
  retryable: boolean;
}

export interface ValidationResult {
  findings: Finding[];
  rejected: Rejection[];
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Find the field that contains the exact quote (extra whitespace ignored). */
export function locateQuote(quote: string, texts: ValidationContext['texts']): TextField | null {
  const q = collapse(quote);
  if (!q) return null;
  for (const [field, text] of Object.entries(texts) as [TextField, string | undefined][]) {
    if (text && collapse(text).includes(q)) return field;
  }
  return null;
}

let counter = 0;
const newId = () => `f${Date.now().toString(36)}${(counter++).toString(36)}`;

function toLocation(m: ModelFinding, ctx: ValidationContext): FindingLocation | string {
  const loc = m.location;
  if (loc.kind === 'text') {
    if (!loc.quote) return 'Text location without a quote.';
    const field = locateQuote(loc.quote, ctx.texts);
    if (!field) return `Quote not found verbatim in the input: "${loc.quote}"`;
    return { kind: 'text', quote: collapse(loc.quote), field };
  }
  if (loc.kind === 'image') {
    if (ctx.mode !== 'image') return 'Image location outside image mode.';
    const slide = loc.slide ?? 0;
    if (!Number.isInteger(slide) || slide < 1 || slide > (ctx.slideCount ?? 0)) {
      return `Slide ${slide} is outside 1–${ctx.slideCount}.`;
    }
    const box = loc.box ?? [];
    if (box.length !== 4 || box.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
      return 'Box must be four numbers between 0 and 1.';
    }
    const [x, y, w, h] = box as [number, number, number, number];
    if (x + w > 1.0001 || y + h > 1.0001 || w <= 0 || h <= 0) return 'Box extends outside the image.';
    return { kind: 'image', slide, box: [x, y, w, h] };
  }
  if (ctx.mode !== 'video') return 'Video location outside video mode.';
  const { start, end } = loc;
  const dur = ctx.duration ?? 0;
  if (start == null || end == null || start < 0 || end < start || end > dur + 0.5) {
    return `Time range ${start}–${end} is outside the ${dur.toFixed(1)}s duration.`;
  }
  return { kind: 'video', start, end, track: loc.track ?? 'frame' };
}

export function validateModelOutput(raw: unknown, ctx: ValidationContext): ValidationResult {
  const rejected: Rejection[] = [];
  const out = ModelOutputSchema.safeParse(raw);
  if (!out.success) {
    return { findings: [], rejected: [{ reason: 'Output is not a { findings: [...] } object.', raw, retryable: true }] };
  }
  const findings: Finding[] = [];
  for (const item of out.data.findings) {
    const parsed = ModelFindingSchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ reason: 'Finding does not match the schema.', raw: item, retryable: true });
      continue;
    }
    const m = parsed.data;
    if (!KEY_MAP[m.key]) {
      rejected.push({ reason: `Unknown rubric key: ${m.key}`, raw: item, retryable: false });
      continue;
    }
    const clause = ctx.clauses.get(m.clause);
    if (!clause) {
      // The model must not cite rules that are not in the library.
      rejected.push({ reason: `Clause not in the library: ${m.clause}`, raw: item, retryable: false });
      continue;
    }
    if (!clause.rubric.includes(m.key)) {
      rejected.push({ reason: `Clause ${m.clause} does not apply to ${m.key}.`, raw: item, retryable: false });
      continue;
    }
    const location = toLocation(m, ctx);
    if (typeof location === 'string') {
      rejected.push({ reason: location, raw: item, retryable: true });
      continue;
    }
    let change = m.change ?? null;
    // A text suggestion always applies to its quote only, never the whole script.
    if (change && location.kind === 'text') change = { from: location.quote, to: change.to };
    let changeRejected = false;
    if (change && suggestionDisguises(change.to)) {
      // Suggestions must not disguise names; all that is left is removing the part.
      change = { from: change.from, to: '' };
      changeRejected = true;
    }
    findings.push({
      id: newId(),
      key: m.key,
      confidence: Math.min(1, Math.max(0, m.confidence)),
      location,
      evidence: m.evidence,
      why: m.why,
      change,
      clause: m.clause,
      removesCoreMessage: m.removesCoreMessage,
      changeRejected: changeRejected || undefined,
      source: 'model',
    });
  }
  return { findings: dedupe(findings), rejected };
}

/** Merge findings with the same key and location, keeping the highest confidence. */
function dedupe(fs: Finding[]): Finding[] {
  const sig = (f: Finding) => {
    const l = f.location;
    const where =
      l.kind === 'text' ? l.quote : l.kind === 'image' ? `${l.slide}:${l.box.map((v) => v.toFixed(2))}` : l.kind === 'video' ? `${l.start}-${l.end}:${l.track}` : l.field;
    return f.key + '|' + where;
  };
  const best = new Map<string, Finding>();
  for (const f of fs) {
    const k = sig(f);
    const cur = best.get(k);
    if (!cur || f.confidence > cur.confidence) best.set(k, f);
  }
  return fs.filter((f) => best.get(sig(f)) === f);
}

/**
 * Add K1 findings for party/official names the model missed,
 * including wordplay spellings and initials.
 */
export function addLexiconFindings(findings: Finding[], ctx: ValidationContext, clauseKey: string): Finding[] {
  if (!ctx.clauses.has(clauseKey)) return findings;
  const extra: Finding[] = [];
  for (const [field, text] of Object.entries(ctx.texts) as [TextField, string | undefined][]) {
    if (!text) continue;
    for (const hit of findPoliticalNames(text)) {
      const covered = [...findings, ...extra].some(
        (f) => f.key === 'K1' && f.location.kind === 'text' && f.location.quote.includes(collapse(hit.match)),
      );
      if (covered) continue;
      extra.push({
        id: newId(),
        key: 'K1',
        confidence: hit.exact ? 0.9 : 0.75,
        location: { kind: 'text', quote: collapse(hit.match), field },
        evidence: hit.exact ? `Name: ${hit.label}` : `Disguised form of: ${hit.label}`,
        why: hit.exact
          ? `The text mentions ${hit.label}. Ads may not reference parties, candidates, or officials.`
          : `"${hit.match}" reads as ${hit.label}. Wordplay, abbreviations, and initials still count as references.`,
        change: { from: hit.match, to: '' },
        clause: clauseKey,
        removesCoreMessage: false,
        source: 'lexicon',
      });
    }
  }
  return [...findings, ...extra];
}

/** Target age from the campaign goal is judged by code, not guessed by the model. */
export function addCampaignFindings(findings: Finding[], campaign: Campaign, clauses: Map<string, unknown>): Finding[] {
  const extra: Finding[] = [];
  const add = (key: string, clause: string, why: string) => {
    if (!clauses.has(clause) || findings.some((f) => f.key === key)) return;
    extra.push({
      id: newId(),
      key,
      confidence: 1,
      location: { kind: 'campaign', field: 'minAge' },
      evidence: `Minimum age ${campaign.minAge}+`,
      why,
      change: null,
      clause,
      removesCoreMessage: false,
      source: 'campaign',
    });
  };
  if (campaign.minAge < 18) add('F8', 'id.pp-17-2025.ads-to-children', `A ${campaign.minAge}+ target includes children under 18.`);
  if (campaign.minAge < 16) add('L4', 'id.permen-komdigi-9-2026.under-16', `A ${campaign.minAge}+ target includes children under 16.`);
  return [...findings, ...extra];
}
