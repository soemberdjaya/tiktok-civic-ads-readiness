import { describe, expect, it } from 'vitest';
import { library, wordCount, MAX_QUOTE_WORDS } from '../src/rules/library';
import { ALL_KEYS } from '../src/scoring/keys';
import { scoreFindings } from '../src/scoring/score';
import { findPoliticalNames, suggestionDisguises } from '../src/validate/lexicon';
import { validateModelOutput } from '../src/validate/findings';
import { applyChange, segmentText } from '../src/lib/highlight';
import { parseSubtitles } from '../src/prepare/media';
import { parseJsonLoose } from '../src/audit/run';
import type { Finding } from '../src/types';

const f = (key: string, confidence: number): Finding => ({
  id: key + confidence, key, confidence, evidence: '', why: '', change: null, clause: 'x', removesCoreMessage: false, source: 'model',
  location: { kind: 'text', quote: 'x', field: 'script' },
});

describe('rule library', () => {
  it('every rubric key has at least one clause', () => {
    const covered = new Set([...library.clauses.values()].flatMap((c) => c.rubric));
    for (const k of ALL_KEYS) expect(covered, k.key).toContain(k.key);
  });
  it('quotes are at most 25 words and every source has an https URL', () => {
    for (const c of library.clauses.values()) {
      if (c.kind === 'quote') expect(wordCount(c.text), c.key).toBeLessThanOrEqual(MAX_QUOTE_WORDS);
      expect(c.file.url.startsWith('https://'), c.key).toBe(true);
    }
  });
  it('the party-name detector clause exists', () => {
    expect(library.clauses.has('tiktok.politics.parties')).toBe(true);
  });
});

describe('scoring engine', () => {
  it('score = 100 − Σ weight × confidence, using the highest confidence per key', () => {
    expect(scoreFindings([f('F1', 1), f('F1', 0.5), f('F3', 0.8)]).score).toBe(100 - 30 - 20);
  });
  it('status per threshold', () => {
    expect(scoreFindings([]).band).toBe('low');
    expect(scoreFindings([f('F1', 1)]).band).toBe('med');
    expect(scoreFindings([f('F1', 1), f('F2', 1), f('F3', 1)]).band).toBe('high');
  });
  it('hard violations only apply at confidence ≥ 0.6', () => {
    expect(scoreFindings([f('K1', 0.6)]).band).toBe('blocked');
    expect(scoreFindings([f('K1', 0.59)]).band).toBe('low');
  });
  it('legal findings do not affect the TikTok score', () => {
    expect(scoreFindings([f('L1', 1), f('L2', 1)])).toMatchObject({ score: 100, band: 'low' });
  });
});

describe('party-name detector', () => {
  it('catches real names, wordplay, and initials', () => {
    const labels = (s: string) => findPoliticalNames(s).map((h) => h.label);
    expect(labels('Dukung Gerindra')).toContain('Gerindra');
    expect(labels('Dukung G3rindra')).toContain('Gerindra');
    expect(labels('Dukung G*rindra')).toContain('Gerindra');
    expect(labels('Dukung Gerindraa')).toContain('Gerindra');
    expect(labels('P.D.I.P menang')).toContain('PDI Perjuangan');
    expect(labels('kader PKS')).toContain('PKS');
    expect(labels('Pilih P4N!')).toContain('PAN');
    expect(labels('pan masak')).not.toContain('PAN');
  });
  it('does not flag common words', () => {
    for (const s of ['umat beragama', 'nilai demokrasi', 'Garuda Pancasila', 'buruh pabrik', 'semangat bergelora', 'pan masak', 'golongan karya seni']) {
      expect(findPoliticalNames(s), s).toEqual([]);
    }
  });
  it('rejects suggestions that disguise names', () => {
    expect(suggestionDisguises('Dukung G*rindra')).toBe(true);
    expect(suggestionDisguises('P4rtai kami')).toBe(true);
    expect(suggestionDisguises('P.D.I. peduli')).toBe(true);
    expect(suggestionDisguises('Baca hasil surveinya')).toBe(false);
    expect(suggestionDisguises('')).toBe(false);
  });
});

describe('location validator', () => {
  const clauses = library.clauses;
  const base = { key: 'F1', confidence: 0.5, evidence: '', why: '', change: null, clause: 'tiktok.politics.officials', removesCoreMessage: false };
  const loc = (l: object) => ({ kind: 'text', quote: null, slide: null, box: null, start: null, end: null, track: null, ...l });

  it('rejects coordinates outside 0–1 and out-of-range slides', () => {
    const ctx = { mode: 'image' as const, texts: {}, slideCount: 2, clauses };
    const r = validateModelOutput(
      {
        findings: [
          { ...base, key: 'K1', clause: 'tiktok.politics.parties', location: loc({ kind: 'image', slide: 1, box: [0.5, 0.5, 0.7, 0.1] }) },
          { ...base, key: 'K1', clause: 'tiktok.politics.parties', location: loc({ kind: 'image', slide: 3, box: [0, 0, 0.1, 0.1] }) },
          { ...base, key: 'K1', clause: 'tiktok.politics.parties', location: loc({ kind: 'image', slide: 2, box: [0.1, 0.1, 0.2, 0.2] }) },
        ],
      },
      ctx,
    );
    expect(r.findings).toHaveLength(1);
    expect(r.rejected).toHaveLength(2);
  });
  it('rejects times outside the duration', () => {
    const ctx = { mode: 'video' as const, texts: {}, duration: 20, clauses };
    const r = validateModelOutput({ findings: [{ ...base, location: loc({ kind: 'video', start: 18, end: 25, track: 'audio' }) }] }, ctx);
    expect(r.findings).toHaveLength(0);
  });
  it('rejects clauses that do not apply to the key', () => {
    const ctx = { mode: 'text' as const, texts: { script: 'DPR buruk' }, clauses };
    const r = validateModelOutput({ findings: [{ ...base, clause: 'id.uu-pdp.children', location: loc({ quote: 'DPR buruk' }) }] }, ctx);
    expect(r.findings).toHaveLength(0);
    expect(r.rejected[0]?.retryable).toBe(false);
  });
  it('accepts quotes with different whitespace', () => {
    const ctx = { mode: 'text' as const, texts: { script: 'DPR akan\nmengesahkan revisi.' }, clauses };
    const r = validateModelOutput({ findings: [{ ...base, location: loc({ quote: 'DPR akan mengesahkan' }) }] }, ctx);
    expect(r.findings).toHaveLength(1);
  });
});

describe('text and media', () => {
  it('highlights and replaces quotes', () => {
    const finding: Finding = { ...f('F3', 0.8), location: { kind: 'text', quote: 'Tanda tangani petisinya sekarang.', field: 'script' } };
    const text = 'Hasilnya jelas. Tanda tangani petisinya sekarang.';
    const segs = segmentText(text, [finding], 'script');
    expect(segs.map((s) => !!s.finding)).toEqual([false, true]);
    expect(applyChange(text, 'Tanda tangani petisinya sekarang.', 'Baca hasil lengkap surveinya.')).toBe('Hasilnya jelas. Baca hasil lengkap surveinya.');
    expect(applyChange('A B C.', 'B', '')).toBe('A C.');
  });
  it('parses SRT and VTT subtitles', () => {
    expect(parseSubtitles('1\n00:00:01,500 --> 00:00:03,000\nHalo semua\n\n2\n00:00:04,000 --> 00:00:05,000\nLagi')).toEqual([
      { start: 1.5, end: 3, text: 'Halo semua' },
      { start: 4, end: 5, text: 'Lagi' },
    ]);
    expect(parseSubtitles('WEBVTT\n\n00:01.000 --> 00:02.000 align:start\n<b>Tes</b>')).toEqual([{ start: 1, end: 2, text: 'Tes' }]);
  });
  it('parses JSON wrapped in text', () => {
    expect(parseJsonLoose('Here it is:\n```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
    expect(parseJsonLoose('ok {"findings": []} done')).toEqual({ findings: [] });
  });
});

describe('validator: suggestions and duplicates', () => {
  const clauses = library.clauses;
  const loc = (quote: string) => ({ kind: 'text', quote, slide: null, box: null, start: null, end: null, track: null });
  const base = { key: 'F3', evidence: '', why: '', clause: 'tiktok.politics.advocacy', removesCoreMessage: false };
  const ctx = { mode: 'text' as const, texts: { script: 'Hasilnya jelas. Tanda tangani petisinya.' }, clauses };

  it('change.from always equals the quote', () => {
    const r = validateModelOutput(
      { findings: [{ ...base, confidence: 0.8, location: loc('Tanda tangani petisinya.'), change: { from: 'Hasilnya jelas. Tanda tangani petisinya.', to: 'Baca hasilnya.' } }] },
      ctx,
    );
    expect(r.findings[0]?.change).toEqual({ from: 'Tanda tangani petisinya.', to: 'Baca hasilnya.' });
  });
  it('merges findings with the same key and quote', () => {
    const r = validateModelOutput(
      {
        findings: [
          { ...base, confidence: 0.5, location: loc('Tanda tangani petisinya.'), change: null },
          { ...base, confidence: 0.9, location: loc('Tanda tangani petisinya.'), change: null },
        ],
      },
      ctx,
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.confidence).toBe(0.9);
  });
});

describe('findings from the campaign goal', () => {
  it('age < 18 adds F8, age < 16 also adds L4', async () => {
    const { addCampaignFindings } = await import('../src/validate/findings');
    const camp = (minAge: number) => ({ objective: 'Traffic', minAge, coreMessage: '', advertiser: '' });
    expect(addCampaignFindings([], camp(18), library.clauses).map((f) => f.key)).toEqual([]);
    expect(addCampaignFindings([], camp(16), library.clauses).map((f) => f.key)).toEqual(['F8']);
    expect(addCampaignFindings([], camp(13), library.clauses).map((f) => f.key)).toEqual(['F8', 'L4']);
  });
});

describe('i18n', () => {
  it('picks singular or plural forms', async () => {
    const { fmt } = await import('../src/i18n');
    expect(fmt('{n} finding|{n} findings', { n: 1 })).toBe('1 finding');
    expect(fmt('{n} finding|{n} findings', { n: 3 })).toBe('3 findings');
    expect(fmt('{n} temuan', { n: 1 })).toBe('1 temuan');
  });
});
