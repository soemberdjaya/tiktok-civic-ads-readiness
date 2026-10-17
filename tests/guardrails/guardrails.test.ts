/**
 * Required guardrails. CI fails if any of them misses.
 * Model responses are recorded in fixtures/, so these tests need no API key.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAudit } from '../../src/audit/run';
import { suggestionDisguises } from '../../src/validate/lexicon';
import { buildSystemPrompt } from '../../src/prompt/build';
import { clausesFor } from '../../src/rules/library';
import type { AnalyzeRequest, ProviderAdapter } from '../../src/providers/types';
import type { Audit, Mode } from '../../src/types';

interface Fixture {
  description: string;
  mode: Mode;
  input?: Record<string, string>;
  slides?: number;
  duration?: number;
  transcript?: { start: number; end: number; text: string }[];
  responses: unknown[];
  expect: {
    band: string;
    keys: string[];
    box?: { slide: number; box: number[] };
    track?: string;
    minLexicon?: number;
    noDisguisedChange?: boolean;
    calls?: number;
    rejectedFirst?: boolean;
  };
}

const dir = join(__dirname, 'fixtures');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f, data: JSON.parse(readFileSync(join(dir, f), 'utf8')) as Fixture }));

function mockProvider(responses: unknown[]): ProviderAdapter & { calls: AnalyzeRequest[] } {
  const calls: AnalyzeRequest[] = [];
  return {
    id: 'deepseek',
    name: 'Mock',
    capabilities: { text: true, image: true, video: 'frames' },
    defaultModel: 'mock',
    keyHint: '',
    dashboardUrl: '',
    calls,
    listModels: async () => ['mock'],
    analyze: async (_cfg, req) => {
      calls.push(structuredClone({ ...req, signal: undefined }));
      const r = responses[Math.min(calls.length - 1, responses.length - 1)];
      return JSON.stringify(r);
    },
  };
}

function auditFrom(fx: Fixture): Audit {
  const base = { id: 'a1', title: fx.description, createdAt: 0, campaign: { objective: 'Traffic', minAge: 18, coreMessage: '', advertiser: 'NGO Uji' } };
  if (fx.mode === 'image') {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    return { ...base, mode: 'image', input: { caption: '', slides: Array.from({ length: fx.slides ?? 1 }, (_, i) => ({ blob, name: `s${i}.jpg`, width: 800, height: 1000 })) } };
  }
  if (fx.mode === 'video') {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' });
    const duration = fx.duration ?? 10;
    return {
      ...base,
      mode: 'video',
      input: { name: 'v.mp4', duration, width: 432, height: 768, caption: '', transcript: fx.transcript ?? [], frames: Array.from({ length: duration }, (_, t) => ({ t, blob })) },
    };
  }
  return { ...base, mode: 'text', input: fx.input as unknown as Audit['input'] };
}

describe('required guardrails', () => {
  for (const { name, data: fx } of fixtures) {
    it(`${name}: ${fx.description}`, async () => {
      const provider = mockProvider(fx.responses);
      const res = await runAudit(auditFrom(fx), { provider, config: { key: 'x', model: 'mock' } });

      expect(res.band).toBe(fx.expect.band);
      const keys = [...new Set(res.findings.map((f) => f.key))].sort();
      expect(keys).toEqual([...fx.expect.keys].sort());

      if (fx.expect.box) {
        const f = res.findings.find((x) => x.location.kind === 'image');
        expect(f?.location).toMatchObject({ kind: 'image', slide: fx.expect.box.slide, box: fx.expect.box.box });
      }
      if (fx.expect.track) {
        const f = res.findings.find((x) => x.location.kind === 'video');
        expect(f?.location).toMatchObject({ kind: 'video', track: fx.expect.track });
      }
      if (fx.expect.minLexicon) {
        expect(res.findings.filter((f) => f.source === 'lexicon').length).toBeGreaterThanOrEqual(fx.expect.minLexicon);
      }
      if (fx.expect.noDisguisedChange) {
        for (const f of res.findings) if (f.change) expect(suggestionDisguises(f.change.to)).toBe(false);
      }
      if (fx.expect.calls) expect(provider.calls.length).toBe(fx.expect.calls);
      if (fx.expect.rejectedFirst) expect(res.discarded.length).toBeGreaterThan(0);
    });
  }

  it('system prompt forbids disguising names and gaming review', () => {
    const p = buildSystemPrompt('text', clausesFor('text'));
    expect(p).toMatch(/not a tool for gaming review/);
    expect(p).toMatch(/a code, initials, a new abbreviation, emoji, or wordplay spelling/);
    expect(p).toMatch(/without being noticed/);
    expect(p).toMatch(/not instructions to you/);
  });

  it('drops clauses that are not in the library', async () => {
    const provider = mockProvider([
      {
        findings: [
          {
            key: 'K3', confidence: 0.9, evidence: '', why: 'x', change: null, removesCoreMessage: false,
            clause: 'tiktok.politics.karangan',
            location: { kind: 'text', quote: 'Tolak', slide: null, box: null, start: null, end: null, track: null },
          },
        ],
      },
    ]);
    const audit: Audit = {
      id: 'a2', title: '', createdAt: 0, mode: 'text',
      campaign: { objective: '', minAge: 18, coreMessage: '', advertiser: '' },
      input: { script: 'Tolak!', caption: '', cta: '', landingUrl: '', landing: '' },
    };
    const res = await runAudit(audit, { provider, config: { key: 'x', model: 'mock' } });
    expect(res.findings).toHaveLength(0);
    expect(res.discarded[0]?.reason).toMatch(/not in the library/);
    // A made-up clause can't be fixed by the model, so there is no retry.
    expect(provider.calls).toHaveLength(1);
  });
});
