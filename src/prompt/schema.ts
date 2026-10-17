import { z } from 'zod';

/**
 * Model output shape. Location is flat (unused fields = null) so the
 * JSON schema works with providers that have limited schema support.
 */
export const ModelFindingSchema = z.object({
  key: z.string(),
  confidence: z.number(),
  location: z.object({
    kind: z.enum(['text', 'image', 'video']),
    quote: z.string().nullable().optional(),
    slide: z.number().nullable().optional(),
    box: z.array(z.number()).nullable().optional(),
    start: z.number().nullable().optional(),
    end: z.number().nullable().optional(),
    track: z.enum(['frame', 'onscreen_text', 'audio']).nullable().optional(),
  }),
  evidence: z.string().default(''),
  why: z.string(),
  change: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
  clause: z.string(),
  removesCoreMessage: z.boolean().default(false),
});

export const ModelOutputSchema = z.object({
  findings: z.array(z.unknown()),
});

export type ModelFinding = z.infer<typeof ModelFindingSchema>;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

export const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'confidence', 'location', 'evidence', 'why', 'change', 'clause', 'removesCoreMessage'],
        properties: {
          key: { type: 'string', description: 'Rubric key, e.g. K3 or F1' },
          confidence: { type: 'number', description: 'Confidence from 0 to 1' },
          location: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'quote', 'slide', 'box', 'start', 'end', 'track'],
            properties: {
              kind: { type: 'string', enum: ['text', 'image', 'video'] },
              quote: nullable({ type: 'string' }),
              slide: nullable({ type: 'integer' }),
              box: nullable({ type: 'array', items: { type: 'number' } }),
              start: nullable({ type: 'number' }),
              end: nullable({ type: 'number' }),
              track: nullable({ type: 'string', enum: ['frame', 'onscreen_text', 'audio'] }),
            },
          },
          evidence: { type: 'string' },
          why: { type: 'string' },
          change: nullable({
            type: 'object',
            additionalProperties: false,
            required: ['from', 'to'],
            properties: { from: { type: 'string' }, to: { type: 'string' } },
          }),
          clause: { type: 'string' },
          removesCoreMessage: { type: 'boolean' },
        },
      },
    },
  },
} as const;
