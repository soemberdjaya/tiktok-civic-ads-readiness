/**
 * Finding keys the model may return.
 * K = TikTok hard violation, F = weighted factor, L = Indonesian law.
 * F weights are a starting point; they are tuned from real review outcomes in later releases.
 */
export const RUBRIC_VERSION = 'r2026.10';

export type Category = 'policy' | 'landing' | 'law';

export interface KeyDef {
  key: string;
  kind: 'knockout' | 'factor' | 'law';
  label: string;
  /** Trigger, used in the model prompt. */
  trigger: string;
  category: Category;
  weight?: number;
}

export const KNOCKOUTS: KeyDef[] = [
  { key: 'K1', kind: 'knockout', category: 'policy', label: 'Party, candidate, or official', trigger: 'Mentions or shows a political party, candidate, party leader, or sitting official, including logos and symbols in images/video. Referring to an official only by their office (e.g. the President, the Minister of Finance, a governor) still counts. Names written as wordplay, abbreviations, or initials still count.' },
  { key: 'K2', kind: 'knockout', category: 'policy', label: 'Election call to action', trigger: 'Calls to vote, not vote, register as a voter, or take part in an election.' },
  { key: 'K3', kind: 'knockout', category: 'policy', label: 'Policy or political-system advocacy', trigger: 'Takes a stance for or against an election, referendum, government outcome, policy proposal, bill, or political system.' },
  { key: 'K4', kind: 'knockout', category: 'policy', label: 'Government or political advertiser', trigger: 'The advertiser is a government, politician, or party, or acts on their behalf.' },
  { key: 'K5', kind: 'knockout', category: 'policy', label: 'AI in a political context', trigger: 'AI-generated visuals or voice in a political context.' },
  { key: 'K6', kind: 'knockout', category: 'policy', label: 'Political opinion form', trigger: 'A form that asks for political opinions or affiliation.' },
  { key: 'K7', kind: 'knockout', category: 'landing', label: 'Prohibited landing-page focus', trigger: 'The landing page’s primary focus is content prohibited above.' },
  { key: 'K8', kind: 'knockout', category: 'policy', label: 'Campaign merchandise', trigger: 'Political campaign merchandise, slogans, or symbols.' },
];

export const FACTORS: KeyDef[] = [
  { key: 'F1', kind: 'factor', category: 'policy', weight: 30, label: 'Judges state institutions', trigger: 'Refers to state institutions or parliament (DPR) in a judgmental tone.' },
  { key: 'F2', kind: 'factor', category: 'policy', weight: 25, label: 'Persuasive policy framing', trigger: 'Persuasive framing about a policy without an explicit stance.' },
  { key: 'F3', kind: 'factor', category: 'policy', weight: 25, label: 'Civic action call', trigger: 'Calls to civic action: petitions, contacting representatives, joining protests.' },
  { key: 'F4', kind: 'factor', category: 'landing', weight: 10, label: 'Political reference on landing page', trigger: 'The landing page contains secondary political references.' },
  { key: 'F5', kind: 'factor', category: 'policy', weight: 15, label: 'Polarising framing', trigger: 'Polarising framing, e.g. us versus them.' },
  { key: 'F6', kind: 'factor', category: 'policy', weight: 15, label: 'Ethnic or religious topic', trigger: 'Topics of ethnicity, religion, race, or inter-group relations (SARA).' },
  { key: 'F7', kind: 'factor', category: 'policy', weight: 20, label: 'Unlabelled AI visuals', trigger: 'Realistic AI visuals without an AI label.' },
  { key: 'F8', kind: 'factor', category: 'policy', weight: 15, label: 'Targets under 18', trigger: 'Targets people under 18.' },
  { key: 'F9', kind: 'factor', category: 'policy', weight: 10, label: 'Political hashtag or slogan', trigger: 'Politically tinged hashtags or slogans.' },
];

export const LAWS: KeyDef[] = [
  { key: 'L1', kind: 'law', category: 'law', label: 'Accusation against a person', trigger: 'Accusation or attack against a named individual (defamation, ITE Law / Criminal Code).' },
  { key: 'L2', kind: 'law', category: 'law', label: 'Identity-based hate speech', trigger: 'Hate speech based on identity.' },
  { key: 'L3', kind: 'law', category: 'law', label: 'Personal data without notice', trigger: 'Collecting personal data without notice (Personal Data Protection Law).' },
  { key: 'L4', kind: 'law', category: 'law', label: 'Content for under-16s', trigger: 'Content for or targeting people under 16.' },
];

export const ALL_KEYS: KeyDef[] = [...KNOCKOUTS, ...FACTORS, ...LAWS];
export const KEY_MAP: Record<string, KeyDef> = Object.fromEntries(ALL_KEYS.map((k) => [k.key, k]));

/** Confidence threshold for hard violations. */
export const KNOCKOUT_CONFIDENCE = 0.6;
