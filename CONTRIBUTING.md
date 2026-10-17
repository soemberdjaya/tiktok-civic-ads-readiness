# Contributing

```bash
pnpm install
pnpm dev     # http://localhost:5173/tiktok-ads/
pnpm test
```

## Updating rules

1. Edit or add YAML in `rules/tiktok/` or `rules/id/`. Clause keys start with the file's `id`.
2. Use `kind: quote` only for original text of at most 25 words. Everything else is `kind: summary`.
3. Bump `rules/VERSION`.
4. Add or update fixtures in `tests/guardrails/fixtures/` if the expected behavior changes.
5. Run `pnpm test`, then `pnpm rules:check --write`.

## Adding a provider

Add one adapter file in `src/providers/` that implements `ProviderAdapter`, then register it in `src/providers/index.ts`. Add its domain to `PROVIDER_ORIGINS` in `vite.config.ts`.

## Adding evaluation cases

One JSON file per case in `evals/cases/`. The format is in [evals/README.md](evals/README.md).

See also [GOVERNANCE.md](GOVERNANCE.md).
