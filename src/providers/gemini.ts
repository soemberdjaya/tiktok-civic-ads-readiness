import { ProviderError, providerFetch, type Part, type ProviderAdapter, type ProviderConfig } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const headers = (cfg: ProviderConfig) => ({ 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key });

function toParts(parts: Part[]) {
  return parts.map((p) => (p.type === 'text' ? { text: p.text } : { inline_data: { mime_type: p.mediaType, data: p.data } }));
}

export const gemini: ProviderAdapter = {
  id: 'gemini',
  name: 'Google Gemini',
  // The only one that accepts a video file with its audio directly.
  capabilities: { text: true, image: true, video: 'native' },
  defaultModel: 'gemini-2.5-flash',
  keyHint: 'AIza…',
  dashboardUrl: 'https://aistudio.google.com/apikey',

  async listModels(cfg) {
    const res = await providerFetch(`${BASE}/models?pageSize=200`, { headers: headers(cfg) });
    const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (j.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .sort();
  },

  async analyze(cfg, req) {
    const model = cfg.model || this.defaultModel;
    const contents = req.turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: toParts(t.content) }));
    const attempts = [
      { responseMimeType: 'application/json', responseJsonSchema: req.schema, temperature: 0 },
      { responseMimeType: 'application/json', temperature: 0 },
    ];
    let lastError: unknown;
    for (const generationConfig of attempts) {
      try {
        const res = await providerFetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: headers(cfg),
          signal: req.signal,
          body: JSON.stringify({ systemInstruction: { parts: [{ text: req.system }] }, contents, generationConfig }),
        });
        const j = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
          promptFeedback?: { blockReason?: string };
        };
        if (j.promptFeedback?.blockReason) {
          throw new ProviderError(`Gemini blocked the request (${j.promptFeedback.blockReason}).`, undefined, 'refusal');
        }
        const cand = j.candidates?.[0];
        if (cand?.finishReason === 'MAX_TOKENS') throw new ProviderError('The model response was cut off for being too long.');
        if (cand?.finishReason === 'SAFETY') throw new ProviderError('Gemini stopped the response due to its safety filter.', undefined, 'refusal');
        return (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'bad_request' && 'responseJsonSchema' in generationConfig) {
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  },
};
