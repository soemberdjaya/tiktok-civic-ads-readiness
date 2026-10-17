# Governance

## Maintainer

Soedja (PT Soember Djaya) owns this repo and maintains the rules library. Outside contributors, including NGOs and agencies, propose changes through pull requests.

## Rules library

| Event | Target |
|---|---|
| The weekly watcher opens a "Rule sources changed" issue | Triaged by a maintainer within 7 days |
| A change that affects findings (new clause, changed quote) | Released within 14 days of triage |
| A minor change (typo, moved URL) | Any time, without a major version bump |

Every rules release bumps `rules/VERSION` using the format `vYYYY.MM`, or `vYYYY.MM.n` for further revisions in the same month. Audit results store the version they used, so older results stay traceable.

Every rule change must include:

- the official source (URL) and the date the source was last updated,
- a new or updated guardrail fixture if the expected behavior changes,
- a passing `pnpm test`.

## Rubric and weights

Factor weights (F1–F9) change only based on data: TikTok review results reported through the **TikTok review result** issue template, or `pnpm eval` results. A weight change bumps `RUBRIC_VERSION` in `src/scoring/keys.ts`.

## What will not be accepted

- Features that help disguise party names, politicians, or symbols to get past review.
- Telemetry, analytics, or third-party scripts.
- A maintainer-run server or database that receives user material.
