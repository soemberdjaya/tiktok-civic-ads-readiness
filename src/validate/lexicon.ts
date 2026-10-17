/**
 * Deterministic detector for party and official names. Used for two things:
 * 1. Adding K1 findings when the model misses a party name, including
 *    wordplay spellings, abbreviations, and initials.
 * 2. Rejecting model suggestions that keep a name in disguised form.
 *
 * This starter list is updated via pull request. Terms that are also common
 * Indonesian words (e.g. "buruh", "umat", "gelora") only match in the full
 * "partai …" form to avoid false positives.
 */
export interface LexiconEntry {
  label: string;
  /** Full forms; also matched with a one-letter tolerance. */
  names: string[];
  /** Abbreviations; only match when written in capitals in the original text. */
  acronyms?: string[];
}

export const LEXICON: LexiconEntry[] = [
  { label: 'PDI Perjuangan', names: ['pdi perjuangan'], acronyms: ['PDIP', 'PDI'] },
  { label: 'Gerindra', names: ['gerindra'] },
  { label: 'Golkar', names: ['golkar'] },
  { label: 'PKB', names: ['partai kebangkitan bangsa'], acronyms: ['PKB'] },
  { label: 'NasDem', names: ['nasdem'] },
  { label: 'PKS', names: ['partai keadilan sejahtera'], acronyms: ['PKS'] },
  { label: 'PAN', names: ['partai amanat nasional'], acronyms: ['PAN'] },
  { label: 'Demokrat', names: ['partai demokrat'] },
  { label: 'PSI', names: ['partai solidaritas indonesia'], acronyms: ['PSI'] },
  { label: 'Perindo', names: ['perindo'] },
  { label: 'PPP', names: ['partai persatuan pembangunan'], acronyms: ['PPP'] },
  { label: 'Hanura', names: ['hanura'] },
  { label: 'Labour Party (Partai Buruh)', names: ['partai buruh'] },
  { label: 'Gelora Party', names: ['partai gelora'] },
  { label: 'Ummat Party', names: ['partai ummat'] },
  { label: 'PBB', names: ['partai bulan bintang'] },
  { label: 'Garuda Party', names: ['partai garuda'] },
  { label: 'PKN', names: ['partai kebangkitan nusantara'] },
  { label: 'President Prabowo Subianto', names: ['prabowo'] },
  { label: 'Vice President Gibran Rakabuming Raka', names: ['gibran'] },
  { label: 'Megawati Soekarnoputri', names: ['megawati'] },
];

const LEET: Record<string, string> = { '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '5': 's', '$': 's', '7': 't' };

/** Lowercase, undo digit-for-letter wordplay, strip disguise marks inside words. */
export function normalizeToken(tok: string): string {
  return tok
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('')
    .replace(/[*#._\-'’`~^]/g, '')
    .replace(/[^a-z]/g, '');
}

function tokens(text: string): { raw: string; norm: string }[] {
  return text
    .split(/[\s,;:()"“”/\\[\]{}?]+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeToken(raw) }))
    .filter((t) => t.norm.length > 0);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

export interface LexiconHit {
  label: string;
  /** The matching original snippet, exactly as in the input. */
  match: string;
  exact: boolean;
}

/** Find party/official names in text, including wordplay spellings and initials. */
export function findPoliticalNames(text: string): LexiconHit[] {
  const toks = tokens(text);
  const hits: LexiconHit[] = [];
  const seen = new Set<string>();
  const push = (h: LexiconHit) => {
    const k = h.label + '|' + h.match;
    if (!seen.has(k)) {
      seen.add(k);
      hits.push(h);
    }
  };

  for (const entry of LEXICON) {
    for (const name of entry.names) {
      const parts = name.split(' ');
      for (let i = 0; i + parts.length <= toks.length; i++) {
        let exact = true;
        let ok = true;
        for (let j = 0; j < parts.length; j++) {
          const t = toks[i + j]!;
          const p = parts[j]!;
          if (t.norm === p) {
            if (t.raw.toLowerCase() !== p) exact = false;
            continue;
          }
          // One-letter tolerance only for distinctive words that are long enough.
          if (p.length >= 5 && t.norm[0] === p[0] && levenshtein(t.norm, p) <= 1) {
            exact = false;
            continue;
          }
          ok = false;
          break;
        }
        if (ok) push({ label: entry.label, match: toks.slice(i, i + parts.length).map((t) => t.raw).join(' '), exact });
      }
    }
    for (const acr of entry.acronyms ?? []) {
      for (const t of toks) {
        // Abbreviations with dots or dashes (P.K.S, P-K-S) still count.
        // Punctuation at the token edges (P4N!, PKS.) is not part of the abbreviation.
        const raw = t.raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
        const letters = raw.replace(/[.\-*_]/g, '');
        // Digit wordplay in abbreviations (P4N → PAN) also counts, if written in capitals.
        const unleet = letters
          .split('')
          .map((ch) => LEET[ch]?.toUpperCase() ?? ch)
          .join('');
        if (letters === letters.toUpperCase() && unleet === acr) push({ label: entry.label, match: raw, exact: raw === acr });
      }
    }
  }
  return hits;
}

const MASKING = /([A-Za-z][*#]+[A-Za-z]?)|([A-Za-z]+\d+[A-Za-z]+)|(\b(?:[A-Z]\.){2,})/;

/**
 * Suggestions must not disguise names: they may not contain a lexicon name in
 * any form, nor disguise patterns such as "G*rindra", "P4rtai", or "P.D.I.".
 */
export function suggestionDisguises(to: string): boolean {
  if (!to.trim()) return false;
  if (MASKING.test(to)) return true;
  return findPoliticalNames(to).length > 0;
}
