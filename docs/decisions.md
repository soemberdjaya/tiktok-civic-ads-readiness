# Product decisions

Answers to the open questions in the product spec (16 Oct 2026).

## License

- Code: **MIT**. The simplest license for other NGOs to fork and use, including agencies working commercially.
- Rule summaries: **CC BY 4.0** (`rules/LICENSE`).
- Quotes from TikTok and regulations: remain the property of their rights holders, at most 25 words per quote, always with a source link. The limit is checked in CI.
- TikTok Sans font: SIL OFL 1.1.

## Product name

**Civic Ad Readiness.** The product name leaves out the word TikTok so it does not read as an official product or infringe the trademark. The repo name (`tiktok-civic-ads-readiness`) is only descriptive. In the UI, TikTok is mentioned only as the target platform, and every screen shows "Independent tool, not affiliated with TikTok."

## Direct calls from the browser

| Provider | CORS | Tested |
|---|---|---|
| DeepSeek | Allowed for GET `/models` and POST `/chat/completions` | Yes, 17 Oct 2026, with a real key, both directly and through soedja.com/tiktok-civic-ad |
| OpenAI | Not tested | — |
| Gemini | Not tested | — |
| OpenRouter | Not tested | — |

Providers that block browser calls can be used through `proxy/`.

## Video transcripts

MVP: upload an `.srt`/`.vtt` subtitle file, or use Gemini, which reads the audio directly. In-browser Whisper is postponed because the model is hundreds of MB and has not been tested on an ordinary laptop.

## Rules library maintainer

Soedja maintains it, with the community contributing through pull requests. Update targets are in [GOVERNANCE.md](../GOVERNANCE.md).

## PSE registration

Interim position, **not legal advice**:

- The tool is a static site. The maintainer does not receive, store, or process user material or data. All processing happens in the user's browser and at the AI provider they choose.
- The obligation to register as a private-scope Electronic System Operator (PSE Lingkup Privat), under Minister of Communication and Informatics Regulation No. 5 of 2020 (Permenkominfo 5/2020) and its amendments, applies to operators that provide, manage, or run an electronic system for users in Indonesia. A static site with no accounts and no data collection is a borderline case.
- An NGO that deploys its own copy is the operator of that copy.

Before a public release on a Soedja domain: get written confirmation from a legal consultant. Prepare a short privacy page (`/privacy`) stating that no data is collected.

## Election Bill

The draft Election Bill (RUU Pemilu) is expected around January 2027 and may change the rules for third parties. When it is published, add it to `rules/id/` as a new source and review key K2.
