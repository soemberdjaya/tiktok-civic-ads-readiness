import { getProvider } from '../providers';
import type { ProviderId } from '../providers/types';
import { writeKey } from '../store/keys';
import type { Settings } from '../store/db';
import { friendlyError } from '../audit/errors';

export interface ConnectResult {
  ok: boolean;
  models: string[];
  /** Model actually used (may be auto-filled from the provider's list). */
  model: string;
  error?: string;
}

/** Save the key and provider settings, then test the connection by loading the model list. */
export async function saveAndTest(
  opts: { provider: ProviderId; key: string; model: string; baseUrl: string; keepOnFail?: boolean },
  settings: Settings,
  update: (p: Partial<Settings>) => Promise<void>,
): Promise<ConnectResult> {
  const p = getProvider(opts.provider);
  const key = opts.key.trim();
  let model = opts.model.trim() || p.defaultModel;
  let models: string[] = [];
  let error: string | undefined;
  try {
    models = await p.listModels({ key, model, baseUrl: opts.baseUrl });
    // Provider without a default model: pick a common one from the list so it works right away.
    if (!model) model = pickModel(models);
  } catch (e) {
    error = friendlyError(e).text;
  }
  // Quick setup saves only keys that work; Settings saves them regardless.
  if (!error || opts.keepOnFail) writeKey(opts.provider, key, settings.keyStorage);
  else return { ok: false, models, model, error };
  await update({ provider: opts.provider, models: { ...settings.models, [opts.provider]: model }, baseUrl: opts.baseUrl.trim() });
  return { ok: !error, models, model, error };
}

/** Preference order for providers without a default model. Users can still change it in Settings. */
const PREFERRED = [
  /^openai\/gpt-5(?!.*(nano|audio|realtime|image|search))/,
  /^google\/gemini-.*-pro/,
  /^gpt-5(?!.*(nano|audio|realtime|image|search|codex))/,
  /^gpt-4\.1(?!.*nano)/,
  /^gpt-4o(?!.*(audio|realtime|search|transcribe|tts))/,
];

export function pickModel(models: string[]): string {
  for (const re of PREFERRED) {
    const hit = models.filter((m) => re.test(m)).sort((a, b) => a.length - b.length)[0];
    if (hit) return hit;
  }
  return models[0] ?? '';
}
