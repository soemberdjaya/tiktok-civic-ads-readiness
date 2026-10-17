import { z } from 'zod';
import type { Mode } from '../types';
import versionRaw from '../../rules/VERSION?raw';

export const ClauseSchema = z.object({
  key: z.string().regex(/^[a-z0-9_.-]+$/),
  /** Rubric keys (K1, F3, L2, …) allowed to cite this clause. */
  rubric: z.array(z.string().regex(/^[KFL]\d+$/)).min(1),
  kind: z.enum(['quote', 'summary']),
  text: z.string().min(1),
  applies_to: z.array(z.enum(['text', 'image', 'video'])).min(1),
});

export const RuleFileSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  /** Watched by CI when the `url` page is unstable (e.g. an official PDF). */
  watch_url: z.string().url().optional(),
  source_updated: z.string().optional(),
  bundled_at: z.string(),
  jurisdiction: z.enum(['tiktok', 'id']),
  clauses: z.array(ClauseSchema).min(1),
});

export type Clause = z.infer<typeof ClauseSchema>;
export type RuleFile = z.infer<typeof RuleFileSchema>;
export type ClauseRef = Clause & { file: RuleFile };

export const MAX_QUOTE_WORDS = 25;

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Validate the library contents. Used at runtime and in CI. */
export function buildLibrary(raw: unknown[]): { files: RuleFile[]; clauses: Map<string, ClauseRef> } {
  const files: RuleFile[] = [];
  const clauses = new Map<string, ClauseRef>();
  for (const r of raw) {
    const file = RuleFileSchema.parse(r);
    for (const c of file.clauses) {
      if (!c.key.startsWith(file.id + '.')) {
        throw new Error(`Clause ${c.key} must start with ${file.id}.`);
      }
      if (clauses.has(c.key)) throw new Error(`Duplicate clause: ${c.key}`);
      if (c.kind === 'quote' && wordCount(c.text) > MAX_QUOTE_WORDS) {
        throw new Error(`Quote ${c.key} exceeds ${MAX_QUOTE_WORDS} words. Use a summary.`);
      }
      clauses.set(c.key, { ...c, file });
    }
    files.push(file);
  }
  return { files, clauses };
}

const modules = import.meta.glob<{ default: unknown }>('../../rules/**/*.yaml', { eager: true });
export const RULES_VERSION = versionRaw.trim();
export const library = buildLibrary(
  Object.keys(modules)
    .sort()
    .map((k) => modules[k]!.default),
);

export function clausesFor(mode: Mode): ClauseRef[] {
  return [...library.clauses.values()].filter((c) => c.applies_to.includes(mode));
}
