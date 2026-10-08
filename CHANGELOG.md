# Changelog

## 1.4.1 (2026-10-08)

Packaging only, no behaviour change: `mcpName`, `server.json` and `glama.json` for the MCP
registries, an MIT `LICENSE` file, and `repository` now points at the public mirror
(github.com/SeoScoreAPI/seoscoreapi-mcp).

## 1.4.0 (2026-10-07)

Core Web Vitals are now opt-in on the API, so audits no longer wait on Google
PageSpeed Insights unless asked:

- `audit` and `batch_audit` take `include_core_web_vitals` (boolean, default false). When
  true the audit also returns measured LCP, INP, CLS, FCP and TTFB under `core_web_vitals`;
  the first measurement of a URL adds about 10 seconds and is cached for 24 hours.
- Without it `core_web_vitals.status` is `not_requested`.
- The option needs an API key: the keyless demo audit never measures Core Web Vitals.

## 1.3.0 (2026-10-06)

Catches the server up with the API. New tools:

- `accessibility_audit`, `ai_readability`, `trackers`, `conversion`, `quick_wins`, `llms_txt`.
- `compare`, `competitive_audit`, `remove_monitor`.
- GEO: `geo_audit`, `geo_brand_probe`, `add_geo_monitor`, `list_geo_monitors`,
  `geo_monitor_history`, `remove_geo_monitor`.
- Site crawl: `crawl_site` (waits for the result), `start_crawl`, `get_crawl`.
- AI citations: `citation_starter_prompts`, `citation_suggest_prompts`,
  `create_citation_tracker`, `list_citation_trackers`, `get_citation_tracker`,
  `update_citation_tracker`, `delete_citation_tracker`, `run_citation_tracker`,
  `get_citation_run`, `citation_tracker_history`, `citation_check`, `citation_topups`,
  `citation_topup_checkout`, `citation_auto_reload` (read-only).
- Not added: report file export (`/audit/export` returns a binary PDF) and any way to
  turn auto-reload on (the API has none for API keys). See the README.
- Tests for the new tools (`test/endpoints.test.js`).

## 1.2.0 (2026-10-02)

- Deep Audit calls go to the main host, `https://seoscoreapi.com`
  (`POST /site-audit`, `GET /site-audit/{job_id}`, `GET /deep-audit/usage`), instead of
  `engine.seoscoreapi.com`. The old host still works.
- New env var `SEO_SCORE_DEEP_AUDIT_URL` to override the Deep Audit host (defaults to
  `SEO_SCORE_BASE_URL`; `SEO_SCORE_ENGINE_URL` is still honoured as a fallback).
- New tools: `start_deep_audit`, `get_deep_audit`, `deep_audit_usage`.
- `deep_audit` takes an optional `timeout_seconds` (default 600, was a fixed 5 minutes) and,
  on timeout, returns the `job_id` so the agent can keep polling with `get_deep_audit`.
- Requests send a `User-Agent: seoscoreapi-mcp/<version>` header.
- Handlers moved to `lib.js` (no behaviour change for the other tools) with tests
  (`npm test`, Node's built-in runner).

## 1.1.0

- `deep_audit` tool (engine host).

Earlier releases: see the git history of `sdks/mcp`.
