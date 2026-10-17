export type ProviderId = 'openai' | 'gemini' | 'deepseek' | 'openrouter' | 'custom';

export type Part =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string }
  | { type: 'video'; mediaType: string; data: string };

export interface ProviderConfig {
  key: string;
  model: string;
  baseUrl?: string;
}

export interface AnalyzeRequest {
  system: string;
  /** User turns. A retry adds a new turn after the model's answer. */
  turns: { role: 'user' | 'assistant'; content: Part[] }[];
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Capabilities {
  text: boolean;
  image: boolean;
  video: 'native' | 'frames' | false;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  capabilities: Capabilities;
  defaultModel: string;
  keyHint: string;
  dashboardUrl: string;
  needsBaseUrl?: boolean;
  listModels(cfg: ProviderConfig): Promise<string[]>;
  /** Returns the model's raw response text (expected to be JSON). */
  analyze(cfg: ProviderConfig, req: AnalyzeRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind: 'auth' | 'rate' | 'cors' | 'bad_request' | 'refusal' | 'other' = 'other',
  ) {
    super(message);
  }
}

/** fetch that turns network failures (usually CORS) into an understandable message. */
export async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ProviderError(
      'The browser couldn\'t reach the provider. Usually the provider blocks direct browser calls (CORS), or the Content Security Policy blocks its URL. Try another provider or set up the optional proxy.',
      undefined,
      'cors',
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let msg = body.slice(0, 400);
    try {
      const j = JSON.parse(body);
      msg = j.error?.message ?? j.message ?? msg;
    } catch {
      /* not JSON */
    }
    const kind = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : res.status === 400 ? 'bad_request' : 'other';
    throw new ProviderError(`${res.status}: ${msg}`, res.status, kind);
  }
  return res;
}
