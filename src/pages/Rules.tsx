import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Layout, Footer } from '../ui/Layout';
import { library, RULES_VERSION, MAX_QUOTE_WORDS, type RuleFile } from '../rules/library';
import { ALL_KEYS, FACTORS, KNOCKOUTS, KNOCKOUT_CONFIDENCE, LAWS, RUBRIC_VERSION, type KeyDef } from '../scoring/keys';
import { LEXICON } from '../validate/lexicon';
import { OUTPUT_JSON_SCHEMA } from '../prompt/schema';
import { buildSystemPrompt } from '../prompt/build';
import { clausesFor } from '../rules/library';
import { CATEGORY_COLOR } from '../ui/findingView';
import { toast } from '../lib/toast';
import { docs as d } from '../i18n/docs.en';
import { t } from '../i18n';
import type { Mode } from '../types';
import hashes from '../../rules/hashes.json';

// Raw YAML is bundled only on this page, to be shown as is.
const rawYaml = import.meta.glob<string>('../../rules/**/*.yaml', { eager: true, query: '?raw', import: 'default' });
const yamlById: Record<string, { path: string; text: string }> = {};
for (const [path, text] of Object.entries(rawYaml)) {
  const id = /^id:\s*(\S+)/m.exec(text)?.[1];
  if (id) yamlById[id] = { path: path.replace('../../', ''), text };
}

const SECTIONS = [
  ['pipeline', d.sections.pipeline],
  ['rubrik', d.sections.rubric],
  ['skor', d.sections.scoring],
  ['validator', d.sections.validation],
  ['skema', d.sections.schema],
  ['prompt', d.sections.prompt],
  ['leksikon', d.sections.lexicon],
  ['sumber', d.sections.sources],
  ['kontribusi', d.sections.contributing],
] as const;
const SECTION_IDS = SECTIONS.map(([id]) => id);

const clauseList = [...library.clauses.values()];
const clausesByKey = (key: string) => clauseList.filter((c) => c.rubric.includes(key));

const EXAMPLE_FINDING = {
  key: 'F3',
  confidence: 0.8,
  location: { kind: 'text', quote: 'Tanda tangani petisinya sekarang.', slide: null, box: null, start: null, end: null, track: null },
  evidence: 'Call to sign a petition',
  why: 'TikTok ads may not push people to act on a policy proposal.',
  change: { from: 'Tanda tangani petisinya sekarang.', to: 'Baca hasil lengkap surveinya.' },
  clause: 'tiktok.politics.advocacy',
  removesCoreMessage: true,
};

const SCORE_SPEC = `score  = max(0, 100 − Σ wᵢ · cᵢ)      i ∈ F keys, cᵢ = max confidence

status = blocked   if any K has c ≥ ${KNOCKOUT_CONFIDENCE}
         high      if score < 40
         med       if 40 ≤ score < 75
         low       if score ≥ 75`;

const SCORE_EXAMPLE = `findings  F1 c=0.80   F4 c=0.60   F1 c=0.50   L1 c=0.90
F1        30 × 0.80 = 24
F4        10 × 0.60 =  6
L1        not counted
score     100 − 24 − 6 = 70  →  med (Needs revision)`;

const YAML_TEMPLATE = `id: tiktok.example
title: "Source document title"
url: https://ads.tiktok.com/help/article/...
jurisdiction: tiktok          # tiktok | id
source_updated: 2026-10
bundled_at: 2026-10-17
# watch_url: https://...pdf
clauses:
  - key: tiktok.example.clause-name
    rubric: [K3, F2]
    kind: quote               # quote ≤ ${MAX_QUOTE_WORDS} words, otherwise summary
    text: "exact quote from the source"
    applies_to: [text, image, video]`;

const COMMANDS = `pnpm test
pnpm rules:check --write
pnpm eval --provider deepseek`;

export function Rules() {
  const [query, setQuery] = useState('');
  const [promptMode, setPromptMode] = useState<Mode>('text');
  const active = useActiveSection(SECTION_IDS);

  // The page loads after the browser tried to scroll to #hash, so scroll again here.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, []);

  const quotes = clauseList.filter((c) => c.kind === 'quote').length;
  const q = query.trim().toLowerCase();
  const matches = (f: RuleFile) =>
    f.clauses.filter((c) => !q || c.key.includes(q) || c.text.toLowerCase().includes(q) || c.rubric.some((r) => r.toLowerCase() === q) || f.title.toLowerCase().includes(q));
  const prompt = useMemo(() => buildSystemPrompt(promptMode, clausesFor(promptMode)), [promptMode]);

  return (
    <Layout section="rules">
      <div className="mx-auto box-border w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6">
        <header className="border-b border-line pb-5">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <Tag>rules {RULES_VERSION}</Tag>
            <Tag>rubric {RUBRIC_VERSION}</Tag>
            <Tag>schema findings.v1</Tag>
          </div>
          <h1 className="m-0 mt-3 text-2xl font-bold tracking-tight">{d.title}</h1>
          <p className="m-0 mt-2 max-w-[760px] text-ink-2">{d.lead}</p>
          <dl className="m-0 mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {[
              [library.files.length, d.stats.sources],
              [clauseList.length, d.stats.clauses],
              [ALL_KEYS.length, d.stats.keys],
              [quotes, d.stats.quotes],
              [clauseList.length - quotes, d.stats.summaries],
            ].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-1.5">
                <dt className="sr-only">{l}</dt>
                <dd className="m-0 font-mono text-lg font-semibold tabular-nums">{n}</dd>
                <span className="text-[13px] text-muted">{l}</span>
              </div>
            ))}
          </dl>
        </header>

        {/* Contents: a scrolling strip on phones, a sticky column on wide screens. */}
        <nav aria-label={d.toc} className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-line bg-page px-4 lg:hidden">
          <div className="flex gap-5 whitespace-nowrap py-2.5 text-[13px]">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={'no-underline ' + (active === id ? 'font-semibold text-ink' : 'text-muted')}>
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label={d.toc} className="hidden lg:block">
            <div className="sticky top-6 pt-6">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">{d.toc}</div>
              <ol className="m-0 flex list-none flex-col p-0 text-[13px]">
                {SECTIONS.map(([id, label], i) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className={
                        'flex gap-2 border-l-2 py-1.5 pl-3 no-underline ' +
                        (active === id ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink')
                      }
                    >
                      <span className="font-mono text-[11px] leading-5 text-muted">{String(i + 1).padStart(2, '0')}</span>
                      {label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <main className="min-w-0">
            <Section id="pipeline" n={1} title={d.sections.pipeline}>
              <ol className="m-0 grid list-none grid-cols-1 gap-px overflow-hidden rounded-[4px] border border-line bg-line p-0 sm:grid-cols-2 xl:grid-cols-3">
                {d.pipeline.steps.map((s, i) => (
                  <li key={s.name} className="bg-panel px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
                      <span className="font-semibold text-ink">
                        {i + 1}. {s.name}
                      </span>
                      <code className="truncate text-muted">{s.file}</code>
                    </div>
                    {s.name === 'provider' && <div className="mt-1 font-mono text-[11px] text-primary">↗ jaringan</div>}
                    <p className="m-0 mt-1.5 text-[13px] text-ink-2">{s.body}</p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="rubrik" n={2} title={d.sections.rubric}>
              <RubricTable title={t.rules.knockouts} defs={KNOCKOUTS} />
              <RubricTable title={t.rules.factors} defs={FACTORS} />
              <RubricTable title={t.rules.laws} defs={LAWS} />
              <p className="m-0 mt-2 text-[13px] text-muted">
                <code className="font-mono">src/scoring/keys.ts</code>
              </p>
            </Section>

            <Section id="skor" n={3} title={d.sections.scoring}>
              <Code title="spesifikasi" text={SCORE_SPEC} />
              <ul className="my-4 flex list-disc flex-col gap-1.5 pl-5 text-ink-2">
                {d.scoring.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <Code title="worked example" text={SCORE_EXAMPLE} />
              <div className="mt-4 overflow-x-auto rounded-[4px] border border-line bg-panel">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[13px] text-muted">
                      <th className="px-4 py-2 font-medium">{d.scoring.bands}</th>
                      <th className="px-4 py-2 font-medium">band</th>
                      <th className="px-4 py-2 font-medium">{d.scoring.condition}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ['blocked', `∃ K, c ≥ ${KNOCKOUT_CONFIDENCE}`, 'var(--color-blocked)'],
                        ['high', 'skor < 40', 'var(--color-bad)'],
                        ['med', '40 ≤ skor < 75', 'var(--color-warn)'],
                        ['low', 'skor ≥ 75', 'var(--color-ok)'],
                      ] as const
                    ).map(([band, cond, color]) => (
                      <tr key={band} className="border-b border-line-2 last:border-0">
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color }} />
                            {t.result.band[band]}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-[13px]">{band}</td>
                        <td className="px-4 py-2 font-mono text-[13px]">{cond}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="m-0 mt-2 text-[13px] text-muted">
                <code className="font-mono">src/scoring/score.ts</code>
              </p>
            </Section>

            <Section id="validator" n={4} title={d.sections.validation}>
              <div className="overflow-x-auto rounded-[4px] border border-line bg-panel">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[13px] text-muted">
                      <th className="px-4 py-2 font-medium">{d.validation.cols.check}</th>
                      <th className="px-4 py-2 font-medium">{d.validation.cols.reject}</th>
                      <th className="px-4 py-2 font-medium">{d.validation.cols.retry}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.validation.rows.map((r) => (
                      <tr key={r.check} className="border-b border-line-2 align-top last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{r.check}</td>
                        <td className="px-4 py-2.5 text-ink-2">{r.reject}</td>
                        <td className="px-4 py-2.5 font-mono text-[13px]">{r.retry ? 'yes' : 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="m-0 mt-1 text-[13px] text-muted">
                <code className="font-mono">src/validate/findings.ts</code> · <code className="font-mono">src/validate/lexicon.ts</code>
              </p>
            </Section>

            <Section id="skema" n={5} title={d.sections.schema}>
              <Code title="OUTPUT_JSON_SCHEMA · src/prompt/schema.ts" text={JSON.stringify(OUTPUT_JSON_SCHEMA, null, 2)} collapsed />
              <div className="mt-4">
                <Code title="example finding" text={JSON.stringify(EXAMPLE_FINDING, null, 2)} />
              </div>
            </Section>

            <Section id="prompt" n={6} title={d.sections.prompt}>
              <div role="tablist" aria-label="Prompt mode" className="mb-2 flex gap-5 border-b border-line text-[13px]">
                {(['text', 'image', 'video'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={promptMode === m}
                    onClick={() => setPromptMode(m)}
                    className={
                      'cursor-pointer border-0 bg-transparent py-2 font-mono ' +
                      (promptMode === m ? 'font-semibold shadow-[inset_0_-2px_0_var(--color-ink)]' : 'text-muted')
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Code title={`buildSystemPrompt('${promptMode}') · ${prompt.length.toLocaleString('en-US')} chars`} text={prompt} collapsed wrap />
            </Section>

            <Section id="leksikon" n={7} title={d.sections.lexicon}>
              <div className="mb-4 rounded-[4px] border border-line bg-panel px-4 py-3">
                <div className="mb-1.5 font-mono text-xs font-semibold">{d.lexicon.normalization}</div>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[13px] text-ink-2">
                  {d.lexicon.normRules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="overflow-x-auto rounded-[4px] border border-line bg-panel">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[13px] text-muted">
                      <th className="px-4 py-2 font-medium">{d.lexicon.cols.label}</th>
                      <th className="px-4 py-2 font-medium">{d.lexicon.cols.names}</th>
                      <th className="px-4 py-2 font-medium">{d.lexicon.cols.acronyms}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEXICON.map((e) => (
                      <tr key={e.label} className="border-b border-line-2 last:border-0">
                        <td className="px-4 py-2">{e.label}</td>
                        <td className="px-4 py-2 font-mono text-[13px]">{e.names.join(', ')}</td>
                        <td className="px-4 py-2 font-mono text-[13px]">{e.acronyms?.join(', ') ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="sumber" n={8} title={d.sections.sources}>
              <label className="mb-4 block">
                <span className="sr-only">{d.sources.filterPlaceholder}</span>
                <input
                  type="search"
                  className="field font-mono text-[13px]"
                  placeholder={d.sources.filterPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {(['tiktok', 'id'] as const).map((j) => {
                const files = library.files.filter((f) => f.jurisdiction === j && matches(f).length > 0);
                if (!files.length) return null;
                return (
                  <div key={j} className="mb-6">
                    <h3 className="m-0 mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-muted">{d.sources.jurisdiction[j]}</h3>
                    <div className="flex flex-col gap-3">
                      {files.map((f) => (
                        <SourceFile key={f.id} file={f} clauses={matches(f)} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {library.files.every((f) => matches(f).length === 0) && <p className="m-0 text-muted">{d.sources.noMatch}</p>}
            </Section>

            <Section id="kontribusi" n={9} title={d.sections.contributing}>
              <Code title={d.contributing.template} text={YAML_TEMPLATE} />
              <div className="mt-4">
                <Code title={d.contributing.commands} text={COMMANDS} />
              </div>
            </Section>

            <Footer />
          </main>
        </div>
      </div>
    </Layout>
  );
}

/** Allow line breaks only after dots or dashes, not mid-word. */
function breakable(key: string) {
  return key.split(/(?<=[.-])/).map((part, i) => (
    <span key={i}>
      {part}
      <wbr />
    </span>
  ));
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-[4px] border border-line bg-panel px-1.5 py-0.5">{children}</span>;
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="scroll-mt-14 border-b border-line py-8 last:border-0 lg:scroll-mt-4">
      <h2 id={`h-${id}`} className="group m-0 flex items-baseline gap-3 text-lg font-bold">
        <span className="font-mono text-xs font-normal text-muted">{String(n).padStart(2, '0')}</span>
        {title}
        <a href={`#${id}`} aria-label={`Link to ${title}`} className="font-mono text-sm font-normal text-muted no-underline opacity-0 group-hover:opacity-100 focus:opacity-100">
          #
        </a>
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Code({ title, text, collapsed, wrap }: { title: string; text: string; collapsed?: boolean; wrap?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  const [copied, setCopied] = useState(false);
  const lines = text.split('\n').length;
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-panel">
      <div className="flex items-center gap-3 border-b border-line bg-hover px-3 py-1.5 font-mono text-xs text-muted">
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="tabular-nums">{lines} lines</span>
        <button
          type="button"
          className="cursor-pointer rounded-[4px] border border-line bg-panel px-2 py-0.5 font-mono text-xs hover:text-ink"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast(t.audit.copyFailed);
            }
          }}
        >
          {copied ? d.copied : d.copy}
        </button>
      </div>
      <pre
        className={
          'm-0 overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink ' +
          (wrap ? 'whitespace-pre-wrap break-words ' : '') +
          (open ? '' : 'max-h-56 overflow-y-hidden')
        }
      >
        {text}
      </pre>
      {collapsed && lines > 12 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full cursor-pointer border-0 border-t border-line bg-hover py-1.5 font-mono text-xs text-muted hover:text-ink"
        >
          {open ? 'collapse' : `show all (${lines} lines)`}
        </button>
      )}
    </div>
  );
}

function RubricTable({ title, defs }: { title: string; defs: KeyDef[] }) {
  return (
    <div className="mb-4 overflow-x-auto rounded-[4px] border border-line bg-panel">
      <div className="border-b border-line bg-hover px-4 py-1.5 font-mono text-xs font-semibold text-muted">{title}</div>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-muted">
            <th className="w-14 px-4 py-2 font-medium">{d.rubric.cols.key}</th>
            <th className="w-24 px-2 py-2 font-medium">{d.rubric.cols.category}</th>
            <th className="w-14 px-2 py-2 text-right font-medium">{d.rubric.cols.weight}</th>
            <th className="px-4 py-2 font-medium">{d.rubric.cols.trigger}</th>
            <th className="w-[34%] px-4 py-2 font-medium">{d.rubric.cols.clauses}</th>
          </tr>
        </thead>
        <tbody>
          {defs.map((k) => (
            <tr key={k.key} id={`k-${k.key}`} className="scroll-mt-16 border-b border-line-2 align-top last:border-0 target:bg-select">
              <td className="px-4 py-2.5 font-mono font-semibold">{k.key}</td>
              <td className="px-2 py-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                  <span aria-hidden="true" className="size-2" style={{ background: CATEGORY_COLOR[k.category] }} />
                  {d.rubric.category[k.category]}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right font-mono tabular-nums">{k.weight ?? '—'}</td>
              <td className="px-4 py-2.5 text-ink-2" title={k.trigger}>
                {k.label}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {clausesByKey(k.key).map((c) => (
                    <a key={c.key} href={`#c-${c.key}`} className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2 no-underline hover:border-ink">
                      {c.key}
                    </a>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceFile({ file, clauses }: { file: RuleFile; clauses: RuleFile['clauses'] }) {
  const [showYaml, setShowYaml] = useState(false);
  const raw = yamlById[file.id];
  const hash = (hashes as Record<string, string>)[file.id];
  return (
    <article id={`f-${file.id}`} className="scroll-mt-16 overflow-hidden rounded-[4px] border border-line bg-panel">
      <header className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <a href={file.url} target="_blank" rel="noreferrer noopener" className="font-semibold">
            {file.title}
          </a>
          <button type="button" className="link-btn font-mono text-xs text-muted" onClick={() => setShowYaml((v) => !v)}>
            {showYaml ? d.sources.hideYaml : d.sources.showYaml}
          </button>
        </div>
        <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs text-muted sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt>{d.sources.meta.id}</dt>
          <dd className="m-0 text-ink">{file.id}</dd>
          <dt>{d.file}</dt>
          <dd className="m-0 truncate">{raw?.path ?? '—'}</dd>
          <dt>{d.sources.meta.updated}</dt>
          <dd className="m-0">{file.source_updated ?? '—'}</dd>
          <dt>{d.sources.meta.bundled}</dt>
          <dd className="m-0">{file.bundled_at}</dd>
          <dt>{d.sources.meta.watch}</dt>
          <dd className="m-0 truncate">{file.watch_url ? 'official pdf' : 'page url'}</dd>
          <dt>{d.sources.meta.hash}</dt>
          <dd className="m-0" title={hash}>
            {hash ? hash.slice(0, 12) : d.sources.notWatched}
          </dd>
        </dl>
      </header>
      {showYaml && raw && (
        <pre className="m-0 max-h-96 overflow-auto border-b border-line bg-hover px-4 py-3 font-mono text-[12px] leading-relaxed">{raw.text}</pre>
      )}
      <ul className="m-0 list-none p-0">
        {clauses.map((c) => (
          <li key={c.key} id={`c-${c.key}`} className="group grid scroll-mt-16 grid-cols-1 gap-x-4 gap-y-1.5 border-b border-line-2 px-4 py-3 last:border-0 target:bg-select md:grid-cols-[260px_1fr]">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <code className="font-mono text-[12.5px] font-semibold">{breakable(c.key)}</code>
                <button
                  type="button"
                  aria-label={d.copyLink}
                  title={d.copyLink}
                  className="cursor-pointer border-0 bg-transparent p-0.5 font-mono text-xs text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
                  onClick={async () => {
                    const url = `${location.origin}${location.pathname}#c-${c.key}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      toast(d.copied);
                    } catch {
                      /* clipboard diblokir */
                    }
                  }}
                >
                  #
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {c.rubric.map((r) => (
                  <a key={r} href={`#k-${r}`} className="rounded-[4px] bg-ink px-1.5 py-px font-mono text-[11px] font-semibold text-white no-underline hover:bg-primary hover:text-white">
                    {r}
                  </a>
                ))}
                <span className="rounded-[4px] border border-line px-1.5 py-px font-mono text-[11px] text-muted">{c.kind}</span>
                <span className="font-mono text-[11px] text-muted">{c.applies_to.join(' · ')}</span>
              </div>
            </div>
            <p className={'m-0 ' + (c.kind === 'quote' ? 'border-l-2 border-line pl-3 italic text-ink' : 'text-ink-2')}>
              {c.kind === 'quote' ? `“${c.text}”` : c.text}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** The section being read, to highlight the table of contents. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}
