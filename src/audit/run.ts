import type { Audit, AuditResult, ImageInput, TextField, TextInput, VideoInput } from '../types';
import type { Part, ProviderAdapter, ProviderConfig } from '../providers/types';
import { buildSystemPrompt, campaignBlock, retryMessage, textParts } from '../prompt/build';
import { OUTPUT_JSON_SCHEMA } from '../prompt/schema';
import { addCampaignFindings, addLexiconFindings, validateModelOutput, type ValidationContext } from '../validate/findings';
import { scoreFindings } from '../scoring/score';
import { RUBRIC_VERSION } from '../scoring/keys';
import { clausesFor, library, RULES_VERSION } from '../rules/library';
import { blobToBase64, formatTime, MAX_NATIVE_VIDEO_BYTES } from '../prepare/media';

/** Clause used by the deterministic party-name detector. */
export const LEXICON_CLAUSE = 'tiktok.politics.parties';

export function textsOf(audit: Audit): ValidationContext['texts'] {
  if (audit.mode === 'text') {
    const i = audit.input as TextInput;
    return { script: i.script, caption: i.caption, cta: i.cta, landing: i.landing };
  }
  return { caption: (audit.input as ImageInput | VideoInput).caption };
}

export const FIELD_LABEL: Record<TextField, string> = {
  script: 'script',
  caption: 'caption',
  cta: 'cta',
  landing: 'landing_page',
};

async function contentParts(audit: Audit, provider: ProviderAdapter, videoFile?: File): Promise<Part[]> {
  const head: Part = { type: 'text', text: campaignBlock(audit.campaign) };
  if (audit.mode === 'text') {
    const i = audit.input as TextInput;
    return [
      head,
      ...textParts([
        { label: 'script', value: i.script },
        { label: 'caption', value: i.caption },
        { label: 'cta', value: i.cta },
        { label: 'landing_page', value: (i.landingUrl ? `URL: ${i.landingUrl}\n` : '') + i.landing },
      ]),
    ];
  }
  if (audit.mode === 'image') {
    const i = audit.input as ImageInput;
    const parts: Part[] = [head, { type: 'text', text: `AD MATERIAL: ${i.slides.length} image slides.` }];
    for (const [n, s] of i.slides.entries()) {
      parts.push({ type: 'text', text: `Slide ${n + 1}:` });
      parts.push({ type: 'image', mediaType: s.blob.type || 'image/jpeg', data: await blobToBase64(s.blob) });
    }
    parts.push(...textParts([{ label: 'caption', value: i.caption }]));
    return parts;
  }
  const v = audit.input as VideoInput;
  const parts: Part[] = [head, { type: 'text', text: `AD MATERIAL: ${v.duration.toFixed(1)}-second video.` }];
  if (provider.capabilities.video === 'native' && videoFile && videoFile.size <= MAX_NATIVE_VIDEO_BYTES) {
    parts.push({ type: 'video', mediaType: videoFile.type || 'video/mp4', data: await blobToBase64(videoFile) });
    parts.push({ type: 'text', text: 'Check the visuals, on-screen text, and audio. Report times in seconds.' });
  } else {
    parts.push({ type: 'text', text: `Frames are sampled once per second. A timestamp label precedes each frame.` });
    for (const f of v.frames) {
      parts.push({ type: 'text', text: `Frame ${formatTime(f.t)} (second ${f.t}):` });
      parts.push({ type: 'image', mediaType: 'image/jpeg', data: await blobToBase64(f.blob) });
    }
  }
  if (v.transcript.length) {
    parts.push({
      type: 'text',
      text: `AUDIO TRANSCRIPT\n${v.transcript.map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join('\n')}`,
    });
  }
  parts.push(...textParts([{ label: 'caption', value: v.caption }]));
  return parts;
}

/** Models sometimes wrap JSON in ``` or a lead-in sentence. */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
    if (fenced) return JSON.parse(fenced[1]!);
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('Model response is not JSON.');
  }
}

export interface RunOptions {
  provider: ProviderAdapter;
  config: ProviderConfig;
  videoFile?: File;
  signal?: AbortSignal;
  onStage?: (stage: 'prepare' | 'model' | 'retry' | 'score') => void;
}

export async function runAudit(audit: Audit, opts: RunOptions): Promise<AuditResult> {
  const { provider, config } = opts;
  if (audit.mode === 'image' && !provider.capabilities.image) {
    throw new Error(`${provider.name} can't read images. Choose another provider in Settings.`);
  }
  if (audit.mode === 'video' && !provider.capabilities.video) {
    throw new Error(`${provider.name} can't read video. Choose another provider in Settings.`);
  }

  opts.onStage?.('prepare');
  const clauses = clausesFor(audit.mode);
  const system = buildSystemPrompt(audit.mode, clauses);
  const content = await contentParts(audit, provider, opts.videoFile);
  const ctx: ValidationContext = {
    mode: audit.mode,
    texts: textsOf(audit),
    slideCount: audit.mode === 'image' ? (audit.input as ImageInput).slides.length : undefined,
    duration: audit.mode === 'video' ? (audit.input as VideoInput).duration : undefined,
    clauses: new Map(clauses.map((c) => [c.key, c])),
  };

  const turns: { role: 'user' | 'assistant'; content: Part[] }[] = [{ role: 'user', content }];
  const req = { system, turns, schema: OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>, signal: opts.signal };

  opts.onStage?.('model');
  let raw = await provider.analyze(config, req);
  let validated = tryValidate(raw, ctx);

  // Retry once if the JSON is broken or a location is invalid.
  const retryReasons = validated.rejected.filter((r) => r.retryable).map((r) => r.reason);
  // Rejection reasons from both attempts are kept for inspection.
  const discarded = [...validated.rejected];
  if (retryReasons.length) {
    opts.onStage?.('retry');
    turns.push({ role: 'assistant', content: [{ type: 'text', text: raw || '{}' }] });
    turns.push({ role: 'user', content: [{ type: 'text', text: retryMessage(retryReasons) }] });
    raw = await provider.analyze(config, req);
    const second = tryValidate(raw, ctx);
    discarded.push(...second.rejected);
    // The second answer replaces the first, unless the second fails completely.
    // Findings still invalid after the second attempt are dropped.
    if (second.findings.length || !validated.findings.length) validated = second;
  }

  opts.onStage?.('score');
  const findings = addCampaignFindings(addLexiconFindings(validated.findings, ctx, LEXICON_CLAUSE), audit.campaign, library.clauses);
  const { score, band } = scoreFindings(findings);
  return {
    id: crypto.randomUUID(),
    auditId: audit.id,
    rulesVersion: RULES_VERSION,
    rubricVersion: RUBRIC_VERSION,
    provider: provider.id,
    model: config.model || provider.defaultModel,
    findings,
    discarded: discarded.map((r) => ({ reason: r.reason, raw: r.raw })),
    score,
    band,
    createdAt: Date.now(),
  };
}

function tryValidate(raw: string, ctx: ValidationContext) {
  try {
    return validateModelOutput(parseJsonLoose(raw), ctx);
  } catch (e) {
    return { findings: [], rejected: [{ reason: (e as Error).message, raw, retryable: true }] };
  }
}

