import { useSyncExternalStore } from 'react';
import type { Audit, AuditResult, Campaign, Mode } from '../types';
import type { ReviewState } from '../ui/ResultPanel';
import type { UiError } from './errors';

export type Stage = 'prepare' | 'model' | 'retry' | 'score';

export interface SessionState<I = Audit['input']> {
  audit: Audit | null;
  result: AuditResult | null;
  title: string;
  campaign: Campaign;
  input: I;
  review: ReviewState;
  stage: Stage | null;
  startedAt: number | null;
  error: UiError | null;
  /** Original video file, in memory only (for playback and sending to Gemini). */
  media?: File;
  loaded: boolean;
  notFound: boolean;
  /** Field values before suggestions were applied, for "Undo changes". */
  before: Record<string, string>;
}

/**
 * Audit sessions live outside components so drafts, applied suggestions,
 * and running audits survive when the user navigates away.
 * Session key = audit id, or "new:<mode>" for a new audit.
 */
const sessions = new Map<string, SessionState>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export const sessionKey = (mode: Mode, id: string | null) => id ?? `new:${mode}`;

export function getSession<I>(key: string): SessionState<I> | undefined {
  return sessions.get(key) as SessionState<I> | undefined;
}

export function setSession<I>(key: string, next: SessionState<I>) {
  sessions.set(key, next as SessionState);
  if (key === 'new:text') persistTextDraft(next as SessionState);
  emit();
}

export function patchSession<I>(key: string, patch: Partial<SessionState<I>> | ((s: SessionState<I>) => Partial<SessionState<I>>)) {
  const cur = sessions.get(key) as SessionState<I> | undefined;
  if (!cur) return;
  const p = typeof patch === 'function' ? patch(cur) : patch;
  setSession(key, { ...cur, ...p });
}

export function deleteSession(key: string) {
  sessions.delete(key);
  if (key === 'new:text') persistTextDraft(null);
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSessionVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

/** Ids of audits the model is checking, for the status in History. */
const runningIds = new Set<string>();
export function markRunning(id: string, on: boolean) {
  if (on) runningIds.add(id);
  else runningIds.delete(id);
  emit();
}
export const isRunning = (id: string) => runningIds.has(id);

/** Running audits, for the indicator in the navigation. */
export function runningSessions(): { key: string; mode: Mode; title: string }[] {
  const out: { key: string; mode: Mode; title: string }[] = [];
  for (const [key, s] of sessions) {
    if (!s.stage) continue;
    const mode = (s.audit?.mode ?? key.replace('new:', '')) as Mode;
    out.push({ key, mode, title: s.title });
  }
  return out;
}

// Text drafts are also saved in the browser to survive a reload. Images and
// video stay in memory only because they are large.
const DRAFT_KEY = 'car.draft.text';

function persistTextDraft(s: SessionState | null) {
  try {
    if (!s) return localStorage.removeItem(DRAFT_KEY);
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: s.title, campaign: s.campaign, input: s.input }));
  } catch {
    /* browser storage blocked: draft stays in memory only */
  }
}

export function readTextDraft(): Pick<SessionState, 'title' | 'campaign' | 'input'> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
