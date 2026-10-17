import { ProviderError, providerFetch, type Capabilities, type Part, type ProviderAdapter, type ProviderConfig, type ProviderId } from './types';

type Mode = 'json_schema' | 'json_object' | 'none';

interface Options {
  id: ProviderId;
  name: string;
  baseUrl: string;
  capabilities: Capabilities;
  defaultModel: string;
  keyHint: string;
  dashboardUrl: string;
  /** Structured output modes, tried in order. */
  modes: Mode[];
  needsBaseUrl?: boolean;
  extraHeaders?: Record<string, string>;
  /** Only for APIs that accept it; OpenAI reasoning models reject temperature other than 1. */
  temperature?: number;
}

function toContent(parts: Part[]) {
  return parts.map((p) => {
    if (p.type === 'text') return { type: 'text', text: p.text };
    if (p.type === 'image') return { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } };
    throw new ProviderError('This provider doesn\'t accept video files directly. Video is sent as frames.');
  });
}

const trimSlash = (s: string) => s.replace(/\/+$/, '');

/** Adapter for APIs that follow the OpenAI Chat Completions format. */
export function openAICompatible(o: Options): ProviderAdapter {
  const base = (cfg: ProviderConfig) => trimSlash(o.needsBaseUrl ? cfg.baseUrl ?? '' : o.baseUrl);
  const headers = (cfg: ProviderConfig) => ({
    'Content-Type': 'application/json',
    ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}),
    ...o.extraHeaders,
  });

  return {
    id: o.id,
    name: o.name,
    capabilities: o.capabilities,
    defaultModel: o.defaultModel,
    keyHint: o.keyHint,
    dashboardUrl: o.dashboardUrl,
    needsBaseUrl: o.needsBaseUrl,

    async listModels(cfg) {
      if (!base(cfg)) throw new ProviderError('Enter the endpoint URL first.');
      const res = await providerFetch(`${base(cfg)}/models`, { headers: headers(cfg) });
      const j = (await res.json()) as { data?: { id: string }[] };
      return (j.data ?? []).map((m) => m.id).sort();
    },

    async analyze(cfg, req) {
      if (!base(cfg)) throw new ProviderError('Enter the endpoint URL first.');
      const allText = req.turns.every((t) => t.content.every((p) => p.type === 'text'));
      const messages = [
        { role: 'system', content: req.system },
        ...req.turns.map((t) => ({
          role: t.role,
          // Some compatible endpoints only accept string content.
          content: allText ? t.content.map((p) => (p as { text: string }).text).join('\n\n') : toContent(t.content),
        })),
      ];

      let lastError: unknown;
      for (const mode of o.modes) {
        const response_format =
          mode === 'json_schema'
            ? { type: 'json_schema', json_schema: { name: 'audit_findings', schema: req.schema, strict: false } }
            : mode === 'json_object'
              ? { type: 'json_object' }
              : undefined;
        try {
          const res = await providerFetch(`${base(cfg)}/chat/completions`, {
            method: 'POST',
            headers: headers(cfg),
            signal: req.signal,
            body: JSON.stringify({
              model: cfg.model || o.defaultModel,
              messages,
              ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
              ...(response_format ? { response_format } : {}),
            }),
          });
          const j = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string }; finish_reason?: string }[] };
          const choice = j.choices?.[0];
          if (choice?.message?.refusal) throw new ProviderError('The model refused to review this material.', undefined, 'refusal');
          if (choice?.finish_reason === 'length') throw new ProviderError('The model response was cut off for being too long.');
          return choice?.message?.content ?? '';
        } catch (e) {
          // Structured mode not supported by this model: try the next mode.
          if (e instanceof ProviderError && e.kind === 'bad_request' && mode !== 'none') {
            lastError = e;
            continue;
          }
          throw e;
        }
      }
      throw lastError;
    },
  };
}

export const openai = openAICompatible({
  id: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  capabilities: { text: true, image: true, video: 'frames' },
  defaultModel: '',
  keyHint: 'sk-…',
  dashboardUrl: 'https://platform.openai.com/api-keys',
  modes: ['json_schema', 'json_object', 'none'],
});

export const deepseek = openAICompatible({
  id: 'deepseek',
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  capabilities: { text: true, image: false, video: false },
  defaultModel: 'deepseek-chat',
  keyHint: 'sk-…',
  dashboardUrl: 'https://platform.deepseek.com/api_keys',
  modes: ['json_object', 'none'],
  temperature: 0,
});

export const openrouter = openAICompatible({
  id: 'openrouter',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  capabilities: { text: true, image: true, video: 'frames' },
  defaultModel: '',
  keyHint: 'sk-or-…',
  dashboardUrl: 'https://openrouter.ai/settings/keys',
  modes: ['json_schema', 'json_object', 'none'],
  extraHeaders: { 'X-Title': 'Civic Ad Readiness' },
});

export const custom = openAICompatible({
  id: 'custom',
  name: 'OpenAI-compatible endpoint',
  baseUrl: '',
  capabilities: { text: true, image: false, video: false },
  defaultModel: '',
  keyHint: 'optional for local models',
  dashboardUrl: '',
  modes: ['json_object', 'none'],
  needsBaseUrl: true,
  temperature: 0,
});
