import type { Band, Finding } from '../types';
import { KEY_MAP, KNOCKOUT_CONFIDENCE } from './keys';

export interface ScoreResult {
  score: number;
  band: Band;
  knockouts: Finding[];
}

/**
 * score = max(0, 100 − Σ wᵢ·cᵢ), computed per factor key at its highest
 * confidence, so the same factor isn't counted more than once.
 * Knockouts (K) don't reduce the score; they set the status directly.
 * Legal findings (L) don't affect the TikTok score.
 */
export function scoreFindings(findings: Finding[]): ScoreResult {
  const maxByKey = new Map<string, number>();
  for (const f of findings) {
    const def = KEY_MAP[f.key];
    if (!def || def.kind !== 'factor') continue;
    maxByKey.set(f.key, Math.max(maxByKey.get(f.key) ?? 0, f.confidence));
  }
  let penalty = 0;
  for (const [key, c] of maxByKey) penalty += (KEY_MAP[key]?.weight ?? 0) * c;
  const score = Math.max(0, Math.round(100 - penalty));

  const knockouts = findings.filter(
    (f) => KEY_MAP[f.key]?.kind === 'knockout' && f.confidence >= KNOCKOUT_CONFIDENCE,
  );
  return { score, band: bandFor(score, knockouts.length > 0), knockouts };
}

export function bandFor(score: number, hasKnockout: boolean): Band {
  if (hasKnockout) return 'blocked';
  if (score < 40) return 'high';
  if (score < 75) return 'med';
  return 'low';
}
