import { ProviderError } from '../providers/types';
import { t } from '../i18n';

export interface UiError {
  text: string;
  /** Show a link to Settings because the problem is the key or provider. */
  settings?: boolean;
}

/** Turn a failure into a message the user can act on. */
export function friendlyError(e: unknown): UiError {
  if (e instanceof ProviderError) {
    switch (e.kind) {
      case 'auth':
        return { text: t.errors.auth, settings: true };
      case 'rate':
        return { text: t.errors.rate };
      case 'cors':
        return { text: t.errors.cors, settings: true };
      case 'refusal':
        return { text: t.errors.refusal, settings: true };
      case 'bad_request':
        return { text: `${t.errors.badRequest} (${e.message})`, settings: true };
    }
    return { text: e.message };
  }
  const msg = (e as Error)?.message ?? String(e);
  if (/can't read (images|video)/.test(msg)) return { text: msg, settings: true };
  return { text: msg };
}
