/** Copy for the Rules page. Translate like en.ts. */
export const docs = {
  title: 'Rules',
  lead: 'Rubric, scoring, validator, prompt, and sources used during an audit.',
  stats: { sources: 'sources', clauses: 'clauses', keys: 'keys', quotes: 'quotes', summaries: 'summaries' },
  toc: 'Contents',
  copy: 'Copy',
  copied: 'Copied',
  copyLink: 'Copy link',
  file: 'file',
  sections: {
    pipeline: 'Pipeline',
    rubric: 'Rubric',
    scoring: 'Scoring',
    validation: 'Validator',
    schema: 'Output schema',
    prompt: 'Prompt',
    lexicon: 'Lexicon',
    sources: 'Sources',
    contributing: 'Contributing',
  },
  pipeline: {
    steps: [
      { name: 'prepare', file: 'src/prepare/media.ts', body: 'Images ≤ 1,568 px. Video at 1 fps, 768 px. Optional subtitles.' },
      { name: 'prompt', file: 'src/prompt/build.ts', body: 'Principles + rubric + clauses per mode.' },
      { name: 'provider', file: 'src/providers/*.ts', body: 'JSON schema → JSON mode → plain text.' },
      { name: 'validate', file: 'src/validate/findings.ts', body: 'zod, location, clause. At most 1 retry.' },
      { name: 'lexicon', file: 'src/validate/lexicon.ts', body: 'Add missed K1s, reject disguised suggestions.' },
      { name: 'score', file: 'src/scoring/score.ts', body: 'Computed in code. Results stored, never edited.' },
    ],
  },
  rubric: {
    cols: { key: 'Key', category: 'Category', weight: 'Weight', trigger: 'Meaning', clauses: 'Clauses' },
    category: { policy: 'policy', landing: 'landing', law: 'law' },
  },
  scoring: {
    rules: ['F: counted once per key, at the highest confidence.', 'K < 0.6: High, does not block.', 'L: does not affect the score.'],
    bands: 'Status',
    condition: 'Condition',
  },
  validation: {
    cols: { check: 'Check', reject: 'Rejected when', retry: 'Retry' },
    rows: [
      { check: 'Output', reject: 'Not JSON { findings: [...] }', retry: true },
      { check: 'Finding', reject: 'Fails the zod schema', retry: true },
      { check: 'Key', reject: 'Not in the rubric', retry: false },
      { check: 'Clause', reject: 'Not in the library / not valid for the key', retry: false },
      { check: 'Text', reject: 'Quote not found verbatim in the input', retry: true },
      { check: 'Image', reject: 'Slide out of range, box outside 0–1', retry: true },
      { check: 'Video', reject: 'Time outside the duration', retry: true },
      { check: 'Suggestion', reject: 'Disguises a name (G*rindra, P4rtai, P.D.I.) → replaced with removal', retry: false },
    ],
  },
  lexicon: {
    normalization: 'Normalisation',
    normRules: ['4→a 3→e 1→i 0→o 5→s 7→t @→a $→s', 'strip * # . _ - \' ` ~ ^ inside words', 'Levenshtein ≤ 1 for words ≥ 5 letters', 'abbreviations only when in capitals'],
    cols: { label: 'Entry', names: 'Names', acronyms: 'Abbreviations' },
  },
  sources: {
    filterPlaceholder: 'Filter: K3, petition, landing…',
    jurisdiction: { tiktok: 'TikTok', id: 'Indonesia' },
    meta: { id: 'id', updated: 'source', bundled: 'bundled', watch: 'watch', hash: 'sha256' },
    showYaml: 'YAML',
    hideYaml: 'Close',
    noMatch: 'No matches.',
    notWatched: '—',
  },
  contributing: {
    template: 'rules/tiktok/example.yaml',
    commands: 'Commands',
  },
};

export type Docs = typeof docs;
