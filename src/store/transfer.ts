import { z } from 'zod';
import { db } from './db';
import { clearKeys } from './keys';
import { PROVIDERS } from '../providers';
import type { Audit, AuditResult, ImageInput, VideoInput } from '../types';

const FORMAT = 'civic-ad-readiness/export';

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

// Decoded by hand, not via fetch(data:), because CSP connect-src disallows data:.
async function dataUrlToBlob(s: string): Promise<Blob> {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(s);
  if (!m) throw new Error('Media in the export file is corrupted.');
  const bin = m[2] ? atob(m[3]!) : decodeURIComponent(m[3]!);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: m[1] ?? 'application/octet-stream' });
}

/** Convert every Blob in the object to a data URL (or null when media is excluded). */
async function encodeBlobs(value: unknown, withMedia: boolean): Promise<unknown> {
  if (value instanceof Blob) return withMedia ? { $blob: await blobToDataUrl(value) } : null;
  if (Array.isArray(value)) return Promise.all(value.map((v) => encodeBlobs(v, withMedia)));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encodeBlobs(v, withMedia);
    return out;
  }
  return value;
}

async function decodeBlobs(value: unknown): Promise<unknown> {
  if (value && typeof value === 'object' && '$blob' in value) return dataUrlToBlob((value as { $blob: string }).$blob);
  if (Array.isArray(value)) return Promise.all(value.map(decodeBlobs));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await decodeBlobs(v);
    return out;
  }
  return value;
}

/** Export audits and their results. API keys are never included. */
export async function exportHistory(withMedia: boolean): Promise<Blob> {
  const audits = await db.audits.toArray();
  const results = await db.results.toArray();
  const payload = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    withMedia,
    audits: await encodeBlobs(audits, withMedia),
    results,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

const ImportSchema = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  audits: z.array(z.record(z.string(), z.unknown())),
  results: z.array(z.record(z.string(), z.unknown())),
});

export async function importHistory(file: File): Promise<{ audits: number; results: number }> {
  const parsed = ImportSchema.parse(JSON.parse(await file.text()));
  const audits = (await decodeBlobs(parsed.audits)) as Audit[];
  for (const a of audits) {
    // Media excluded from the export is dropped from the list, not left broken.
    if (a.mode === 'image') {
      const inp = a.input as ImageInput;
      inp.slides = inp.slides.filter((s) => s.blob instanceof Blob);
    }
    if (a.mode === 'video') {
      const inp = a.input as VideoInput;
      inp.frames = inp.frames.filter((f) => f.blob instanceof Blob);
    }
  }
  await db.transaction('rw', db.audits, db.results, async () => {
    await db.audits.bulkPut(audits);
    await db.results.bulkPut(parsed.results as unknown as AuditResult[]);
  });
  return { audits: audits.length, results: parsed.results.length };
}

/** Delete keys, history, and settings. No copy exists elsewhere. */
export async function wipeEverything() {
  clearKeys(PROVIDERS.map((p) => p.id));
  await db.delete();
  await db.open();
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
