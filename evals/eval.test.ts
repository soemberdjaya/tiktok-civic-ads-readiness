/**
 * Run via `pnpm eval --provider <id>`. Uses your own API key.
 * Image/video cases are skipped for providers that can't read them.
 */
import { describe, it } from 'vitest';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runAudit } from '../src/audit/run';
import { getProvider } from '../src/providers';
import type { ProviderId } from '../src/providers/types';
import type { Audit, AuditResult, Mode } from '../src/types';

const providerId = (process.env.EVAL_PROVIDER ?? 'deepseek') as ProviderId;
const provider = getProvider(providerId);
const key = process.env[`${providerId.toUpperCase()}_API_KEY`] ?? '';
const model = process.env.EVAL_MODEL || provider.defaultModel;
const baseUrl = process.env.CUSTOM_BASE_URL;

interface Case {
  id: string;
  mode: Mode;
  input: Record<string, unknown>;
  campaign: Audit['campaign'];
  expect: { band?: string; notBand?: string; must?: string[]; mustAny?: string[]; mustNot?: string[] };
}

const dir = join(import.meta.dirname, 'cases');
const mediaDir = join(import.meta.dirname, 'media');
const only = (process.env.EVAL_ONLY ?? '').split(',').filter(Boolean);
const cases = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Case)
  .filter((c) => !only.length || only.includes(c.id));

const blobOf = (file: string) => new Blob([readFileSync(join(mediaDir, file))], { type: file.endsWith('.png') ? 'image/png' : 'image/jpeg' });

function toAudit(c: Case): Audit {
  const base = { id: c.id, title: c.id, createdAt: 0, campaign: c.campaign };
  if (c.mode === 'image') {
    const i = c.input as { slides: string[]; caption: string };
    return { ...base, mode: 'image', input: { caption: i.caption, slides: i.slides.map((f) => ({ blob: blobOf(f), name: f, width: 800, height: 1000 })) } };
  }
  if (c.mode === 'video') {
    const i = c.input as { frames: string[]; duration: number; transcript: { start: number; end: number; text: string }[]; caption: string };
    return {
      ...base,
      mode: 'video',
      input: { name: c.id, duration: i.duration, width: 432, height: 768, caption: i.caption, transcript: i.transcript, frames: i.frames.map((f, t) => ({ t, blob: blobOf(f) })) },
    };
  }
  return { ...base, mode: 'text', input: c.input as unknown as Audit['input'] };
}

function supported(mode: Mode) {
  if (mode === 'image') return provider.capabilities.image;
  if (mode === 'video') return !!provider.capabilities.video;
  return true;
}

function judge(c: Case, r: AuditResult): string[] {
  const keys = new Set(r.findings.map((f) => f.key));
  const fails: string[] = [];
  if (c.expect.band && r.band !== c.expect.band) fails.push(`band ${r.band} ≠ ${c.expect.band}`);
  if (c.expect.notBand && r.band === c.expect.notBand) fails.push(`band must not be ${c.expect.notBand}`);
  for (const k of c.expect.must ?? []) if (!keys.has(k)) fails.push(`missing ${k}`);
  if (c.expect.mustAny && !c.expect.mustAny.some((k) => keys.has(k))) fails.push(`missing one of ${c.expect.mustAny.join('/')}`);
  for (const k of c.expect.mustNot ?? []) if (keys.has(k)) fails.push(`must not have ${k}`);
  return fails;
}

type Row = { id: string; mode: Mode; ok: boolean; skipped?: boolean; fails: string[]; band?: string; keys?: string[]; discarded?: string[]; error?: string };

describe(`eval ${providerId} · ${model}`, () => {
  it('runs all cases', { timeout: 60 * 60_000 }, async () => {
    if (!key && providerId !== 'custom') throw new Error(`Set ${providerId.toUpperCase()}_API_KEY first.`);
    const rows: Row[] = [];
    for (const c of cases) {
      if (!supported(c.mode)) {
        rows.push({ id: c.id, mode: c.mode, ok: false, skipped: true, fails: [] });
        continue;
      }
      try {
        const r = await runAudit(toAudit(c), { provider, config: { key, model, baseUrl } });
        const fails = judge(c, r);
        rows.push({ id: c.id, mode: c.mode, ok: !fails.length, fails, band: r.band, keys: [...new Set(r.findings.map((f) => f.key))], discarded: r.discarded.map((x) => x.reason) });
      } catch (e) {
        rows.push({ id: c.id, mode: c.mode, ok: false, fails: [], error: (e as Error).message });
      }
      const last = rows.at(-1)!;
      process.stdout.write(`${last.ok ? 'OK  ' : 'FAIL'} ${c.id.padEnd(22)} ${last.error ?? last.fails.join('; ')}\n`);
    }
    const ran = rows.filter((r) => !r.skipped);
    const ok = ran.filter((r) => r.ok).length;
    const byMode = (['text', 'image', 'video'] as const)
      .map((m) => {
        const rs = ran.filter((r) => r.mode === m);
        return rs.length ? `${m} ${rs.filter((r) => r.ok).length}/${rs.length}` : null;
      })
      .filter(Boolean)
      .join(' · ');
    const skipped = rows.length - ran.length;
    process.stdout.write(`\nAgreement ${providerId}/${model}: ${ok}/${ran.length} (${Math.round((ok / Math.max(1, ran.length)) * 100)}%) · ${byMode}${skipped ? ` · ${skipped} skipped` : ''}\n`);
    mkdirSync(join(import.meta.dirname, 'results'), { recursive: true });
    writeFileSync(
      join(import.meta.dirname, 'results', `${providerId}-${model.replace(/[^\w.-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`),
      JSON.stringify({ provider: providerId, model, ok, total: ran.length, skipped, rows }, null, 2),
    );
  });
});
