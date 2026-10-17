# Evaluation set

Labeled cases that measure how often each provider and model agrees with human labels.
It holds 54 cases: 48 text, 4 image, 2 video (synthetic media in `evals/media/`). Image and video cases are skipped for providers that cannot read them.

The labels were written by the development team and need review by people who handle TikTok ad review.

## Running

```bash
DEEPSEEK_API_KEY=...  pnpm eval --provider deepseek --model deepseek-chat
DEEPSEEK_API_KEY=...  pnpm eval --provider deepseek --only push-back-bill,petition
```

Key variables per provider: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `CUSTOM_API_KEY` (plus `CUSTOM_BASE_URL`).
Each case calls the model once or twice, so keep an eye on cost.

Results are written to `evals/results/` (not committed). A summary per provider is published in the main README.

## Case format

```json
{
  "id": "push-back-bill",
  "mode": "text",
  "input": { "script": "...", "caption": "", "cta": "", "landingUrl": "", "landing": "" },
  "campaign": { "objective": "Traffic", "minAge": 18, "coreMessage": "", "advertiser": "Example NGO" },
  "expect": { "band": "blocked", "must": ["K3"], "mustAny": ["F2", "K3"], "mustNot": [], "notBand": "low" }
}
```

All `expect` fields are optional. A case counts as agreeing when every condition is met.
