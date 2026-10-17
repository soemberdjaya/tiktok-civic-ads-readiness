import { gemini } from './gemini';
import { custom, deepseek, openai, openrouter } from './openaiCompat';
import type { ProviderAdapter, ProviderId } from './types';

/** Adding a provider takes one adapter file and one line here. */
export const PROVIDERS: ProviderAdapter[] = [deepseek, openai, gemini, openrouter, custom];

export function getProvider(id: ProviderId): ProviderAdapter {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}
