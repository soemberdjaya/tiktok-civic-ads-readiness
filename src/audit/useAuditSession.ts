import { useCallback, useEffect } from 'react';
import type { Audit, Campaign, Finding, Mode } from '../types';
import { db, latestResult, newId } from '../store/db';
import { runAudit } from './run';
import { useSettings } from '../lib/settings';
import { currentRoute, navigate, useRoute } from '../lib/router';
import { toast } from '../lib/toast';
import { friendlyError } from './errors';
import { DEFAULT_CAMPAIGN } from '../ui/CampaignDialog';
import {
  deleteSession,
  getSession,
  markRunning,
  patchSession,
  readTextDraft,
  sessionKey,
  setSession,
  useSessionVersion,
  type SessionState,
} from './sessionStore';
import { t, fmt } from '../i18n';

export const MODE_PATH: Record<Mode, string> = { text: '/audit/text', image: '/audit/image', video: '/audit/video' };

const emptyReview = () => ({ selected: null, applied: new Set<string>(), dismissed: new Set<string>() });
const controllers = new Map<string, AbortController>();

function freshSession<I>(input: I): SessionState<I> {
  return {
    audit: null,
    result: null,
    title: '',
    campaign: DEFAULT_CAMPAIGN,
    input,
    review: emptyReview(),
    stage: null,
    startedAt: null,
    error: null,
    loaded: true,
    notFound: false,
    before: {},
  };
}

type StringKeys<I> = { [K in keyof I]: I[K] extends string ? K : never }[keyof I];

/**
 * State for one audit screen. Kept in sessionStore so it survives
 * navigation, and a running audit finishes in the background.
 * Old results are never changed: a re-audit adds a new entry.
 */
export function useAuditSession<I extends Audit['input']>(mode: Mode, emptyInput: () => I) {
  const { provider, config } = useSettings();
  const { query } = useRoute();
  const id = query.get('id');
  const key = sessionKey(mode, id);
  useSessionVersion();

  // Create the session on first open: a new draft, or load from IndexedDB.
  useEffect(() => {
    if (getSession(key)) return;
    if (!id) {
      const draft = mode === 'text' ? readTextDraft() : null;
      setSession(key, { ...freshSession(emptyInput()), ...(draft as Partial<SessionState<I>> | null) });
      return;
    }
    setSession(key, { ...freshSession(emptyInput()), loaded: false });
    void (async () => {
      const a = await db.audits.get(id);
      if (!a || a.mode !== mode) return patchSession(key, { loaded: true, notFound: true });
      const result = (await latestResult(a.id)) ?? null;
      patchSession<I>(key, {
        audit: a,
        result,
        title: a.title,
        campaign: a.campaign,
        input: structuredClone(a.input) as I,
        review: { ...emptyReview(), selected: result?.findings[0]?.id ?? null },
        loaded: true,
      });
    })();
    // emptyInput is stable per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const s = getSession<I>(key) ?? freshSession(emptyInput());
  const patch = (p: Partial<SessionState<I>> | ((s: SessionState<I>) => Partial<SessionState<I>>)) => patchSession<I>(key, p);

  const run = useCallback(
    async (opts: { inputChanged: boolean }) => {
      const cur = getSession<I>(key);
      if (!cur || cur.stage) return;
      const ctrl = new AbortController();
      controllers.set(key, ctrl);
      patchSession<I>(key, { error: null, stage: 'prepare', startedAt: Date.now() });
      // Changed material is saved as a new audit so old results still match their input.
      const next: Audit =
        cur.audit && !opts.inputChanged
          ? { ...cur.audit, title: cur.title || cur.audit.title, campaign: cur.campaign }
          : { id: newId(), mode, title: cur.title.trim() || defaultTitle(mode, cur.input), input: cur.input, campaign: cur.campaign, createdAt: Date.now() };
      try {
        await db.audits.put(next);
        markRunning(next.id, true);
        const res = await runAudit(next, {
          provider,
          config,
          videoFile: cur.media,
          signal: ctrl.signal,
          onStage: (stage) => patchSession(key, { stage }),
        });
        await db.results.add(res);

        const nextKey = sessionKey(mode, next.id);
        setSession<I>(nextKey, {
          ...freshSession(structuredClone(next.input) as I),
          audit: next,
          result: res,
          title: next.title,
          campaign: next.campaign,
          media: cur.media,
          review: { ...emptyReview(), selected: res.findings[0]?.id ?? null },
        });
        if (nextKey !== key) {
          // If the user is still on the same screen, move them to the new audit URL.
          const here = currentRoute();
          const stillHere = here.path === MODE_PATH[mode] && (here.query.get('id') ?? null) === id;
          if (key.startsWith('new:')) deleteSession(key);
          else patchSession(key, { stage: null, startedAt: null });
          if (stillHere) navigate(`${MODE_PATH[mode]}?id=${next.id}`, true);
          else toast(fmt(t.audit.doneToast, { title: next.title }), { link: { to: `${MODE_PATH[mode]}?id=${next.id}`, label: t.audit.openResult } });
        }
      } catch (e) {
        const aborted = (e as Error).name === 'AbortError' || ctrl.signal.aborted;
        patchSession(key, { stage: null, startedAt: null, error: aborted ? null : friendlyError(e) });
      } finally {
        markRunning(next.id, false);
        controllers.delete(key);
      }
    },
    [config, id, key, mode, provider],
  );

  const cancel = () => {
    controllers.get(key)?.abort();
    patch({ stage: null, startedAt: null });
  };

  const setInput = (update: (i: I) => I) => patch((cur) => ({ input: update(cur.input) }));

  const saveMeta = async (p: { title?: string; campaign?: Campaign }) => {
    patch(p);
    // Title and campaign goal may change without changing results.
    if (s.audit) await db.audits.update(s.audit.id, p);
  };

  const reviewActions = {
    select: (selected: string | null) => patch((cur) => ({ review: { ...cur.review, selected } })),
    /** Apply a suggestion to one text field and keep the previous value for undo. */
    applyField: (f: Finding, field: StringKeys<I>, update: (v: string) => string) =>
      patch((cur) => {
        const prev = cur.input[field] as string;
        return {
          input: { ...cur.input, [field]: update(prev) },
          before: { ...cur.before, [f.id]: prev },
          review: { ...cur.review, selected: null, applied: new Set(cur.review.applied).add(f.id) },
        };
      }),
    undoField: (f: Finding, field: StringKeys<I>) =>
      patch((cur) => {
        if (!(f.id in cur.before)) return {};
        const applied = new Set(cur.review.applied);
        applied.delete(f.id);
        return { input: { ...cur.input, [field]: cur.before[f.id] }, review: { ...cur.review, applied } };
      }),
    dismiss: (f: Finding) => patch((cur) => ({ review: { ...cur.review, selected: null, dismissed: new Set(cur.review.dismissed).add(f.id) } })),
    restore: () => patch((cur) => ({ review: { ...cur.review, dismissed: new Set() } })),
  };

  /** Clear the screen for a new audit in this mode. */
  const startNew = () => {
    deleteSession(sessionKey(mode, null));
    navigate(MODE_PATH[mode]);
  };

  return {
    ...s,
    loading: !s.loaded,
    busy: s.stage !== null,
    setInput,
    setError: (text: string | null) => patch({ error: text ? { text } : null }),
    setMedia: (media: File | undefined) => patch({ media }),
    run,
    cancel,
    saveMeta,
    reviewActions,
    startNew,
  };
}

function defaultTitle(mode: Mode, input: Audit['input']): string {
  const source = 'script' in input ? input.script || input.caption : 'caption' in input ? input.caption : '';
  const words = source.trim().split(/\s+/).slice(0, 6).join(' ');
  if (words) return words.length > 48 ? words.slice(0, 48) + '…' : words;
  return { text: 'Text audit', image: 'Image audit', video: 'Video audit' }[mode];
}
