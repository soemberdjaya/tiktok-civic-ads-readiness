export type Mode = 'text' | 'image' | 'video';

export type TextField = 'script' | 'caption' | 'cta' | 'landing';

export type FindingLocation =
  | { kind: 'text'; quote: string; field?: TextField }
  | { kind: 'image'; slide: number; box: [number, number, number, number] }
  | { kind: 'video'; start: number; end: number; track: 'frame' | 'onscreen_text' | 'audio' }
  /** Finding from campaign settings, not the material (e.g. target age). */
  | { kind: 'campaign'; field: 'minAge' };

export interface Finding {
  id: string;
  key: string;
  confidence: number;
  location: FindingLocation;
  /** Evidence the model saw (text it read, objects in the frame). */
  evidence: string;
  why: string;
  /** Empty `to` means the suggestion deletes that part. */
  change: { from: string; to: string } | null;
  clause: string;
  removesCoreMessage: boolean;
  /** Set when the model's suggestion was rejected for disguising a name or symbol. */
  changeRejected?: boolean;
  /** model, lexicon (name detector), or campaign (rule from campaign settings). */
  source: 'model' | 'lexicon' | 'campaign';
}

export type Band = 'blocked' | 'high' | 'med' | 'low';

export interface Campaign {
  objective: string;
  minAge: number;
  coreMessage: string;
  advertiser: string;
}

export interface TextInput {
  script: string;
  caption: string;
  cta: string;
  landingUrl: string;
  landing: string;
}

export interface ImageInput {
  slides: { blob: Blob; name: string; width: number; height: number }[];
  caption: string;
}

export interface VideoInput {
  name: string;
  duration: number;
  frames: { t: number; blob: Blob }[];
  transcript: { start: number; end: number; text: string }[];
  caption: string;
  width: number;
  height: number;
}

export interface Audit {
  id: string;
  mode: Mode;
  title: string;
  input: TextInput | ImageInput | VideoInput;
  campaign: Campaign;
  createdAt: number;
}

export interface AuditResult {
  id: string;
  auditId: string;
  rulesVersion: string;
  rubricVersion: string;
  provider: string;
  model: string;
  findings: Finding[];
  /** Findings dropped by the validator, kept for inspection. */
  discarded: { reason: string; raw: unknown }[];
  score: number;
  band: Band;
  createdAt: number;
}
