import Dexie, { type EntityTable } from 'dexie';
import type { Audit, AuditResult } from '../types';
import type { ProviderId } from '../providers/types';

export interface Settings {
  id: 'app';
  provider: ProviderId;
  /** Model per provider, so switching providers keeps the previous choice. */
  models: Partial<Record<ProviderId, string>>;
  baseUrl: string;
  keyStorage: 'local' | 'session';
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  provider: 'deepseek',
  models: {},
  baseUrl: 'http://localhost:11434/v1',
  keyStorage: 'local',
};

/** API keys are never stored here. See keys.ts. */
export class CivicDB extends Dexie {
  audits!: EntityTable<Audit, 'id'>;
  results!: EntityTable<AuditResult, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('civic-ad-readiness');
    this.version(1).stores({
      audits: 'id, mode, createdAt',
      results: 'id, auditId, createdAt',
      settings: 'id',
    });
  }
}

export const db = new CivicDB();

const KNOWN_PROVIDERS: ProviderId[] = ['deepseek', 'openai', 'gemini', 'openrouter', 'custom'];

export async function getSettings(): Promise<Settings> {
  const s = { ...DEFAULT_SETTINGS, ...(await db.settings.get('app')) };
  // Settings from older versions may hold a provider that no longer exists.
  if (!KNOWN_PROVIDERS.includes(s.provider)) s.provider = DEFAULT_SETTINGS.provider;
  return s;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'app' as const };
  await db.settings.put(next);
  return next;
}

export async function latestResult(auditId: string): Promise<AuditResult | undefined> {
  const all = await db.results.where('auditId').equals(auditId).sortBy('createdAt');
  return all.at(-1);
}

export const newId = () => crypto.randomUUID();
