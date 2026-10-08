# SEO Score API — Model Context Protocol Server

Give Claude Desktop, Claude Code, Cursor, Windsurf, or any MCP-aware AI tool direct access to the [SEO Score API](https://seoscoreapi.com): full audits, backlink data, monitoring, and history.

## Quick start

```bash
npx -y seoscoreapi-mcp
```

Set your API key once and forget it:

```bash
export SEO_SCORE_API_KEY="ssa_your_key_here"
```

(Get a free key at https://seoscoreapi.com — no card required.)

## Tools exposed

| Tool | What it does | Plan |
|---|---|---|
| `audit` | Full SEO audit on a URL — score, grade, 80+ checks, AI readability, prioritized fixes. `include_core_web_vitals: true` adds measured LCP, INP and CLS (about 10 seconds slower, needs a key) | Free |
| `batch_audit` | Audit up to 10 URLs at once (`include_core_web_vitals` optional) | Starter ($5/mo) |
| `usage` | Current plan + monthly usage + remaining quota | Free |
| `report_url` | Public shareable HTML report for a domain | Free |
| `add_monitor` | Add a URL to scheduled re-audit + alerts | Starter |
| `list_monitors` | List monitored URLs | Starter |
| `history` | Time-series of past scores for a URL | Starter |
| `history_domains` | Every domain audited by this key with 30-day trend | Starter |
| `backlinks` | Observed backlinks for a domain (audit-fed graph; honest data caveat in every response) | **Basic ($15/mo)** |
| `deep_audit` | Deep Site Audit: 9 dimensions, thousands of catalog checks + up to 150 AI checks; waits for the result (`timeout_seconds`, default 600) | **Pro ($39/mo)**, Ultra, or credits |
| `start_deep_audit` | Queue a Deep Site Audit and return its `job_id` at once (optional `webhook_url`) | same |
| `get_deep_audit` | Status of a Deep Site Audit job, with the `result` once completed | same |
| `deep_audit_usage` | Deep Site Audits used and remaining this month | same |
| `remove_monitor` | Remove a URL from score monitoring | Starter |
| `compare` | Structured diff across 2-5 URLs | Basic ($15/mo) |
| `competitive_audit` | Head-to-head against a competitor's page for a keyword | Pro ($39/mo) |
| `accessibility_audit` | ADA / WCAG 2.1 AA audit: score, lawsuit risk, violations with fixes (`include_trackers` optional) | Paid plans; own monthly allowance |
| `ai_readability` | How well AI/LLM systems can consume a page | Any key |
| `trackers` | Third-party trackers and pixels a page loads | Any key (one audit) |
| `conversion` | Conversion score: headline, CTA, trust, forms, objections | Any key (one audit); full fix list on paid plans |
| `quick_wins` | Page-2 quick wins from Search Console rows or CSV you pass in | Any key (one audit) |
| `llms_txt` | Generate an llms.txt file for a domain | No key needed; curated version on Basic+ |
| `geo_audit` | GEO audit: how visible a page is to LLMs | Basic |
| `geo_brand_probe` | How often LLMs mention a brand | Basic |
| `add_geo_monitor` / `list_geo_monitors` / `geo_monitor_history` / `remove_geo_monitor` | GEO monitoring | Basic |
| `crawl_site` | Multi-page site crawl (broken pages, redirects, duplicates, orphans, slow pages); waits for the result | Pro, Ultra, or a Deep Audit credit |
| `start_crawl` / `get_crawl` | Start a crawl and poll it yourself | same |
| `citation_starter_prompts` / `citation_suggest_prompts` | Prompts to track for AI citations | Any key; not metered |
| `create_citation_tracker` / `list_citation_trackers` / `get_citation_tracker` / `update_citation_tracker` / `delete_citation_tracker` | Track a brand across ChatGPT, Gemini, Perplexity and Claude | Starter ($5/mo) |
| `run_citation_tracker` / `get_citation_run` / `citation_tracker_history` | Run a tracker, read a run, read the trend | Starter; metered in checks |
| `citation_check` | One-off citation check for a brand and one prompt | Paid plans; metered per check |
| `citation_topups` | Top-up packs and the account's check balance | Any key |
| `citation_topup_checkout` | Stripe Checkout link for a top-up pack (charges nothing until the user pays it) | Paid plans |
| `citation_auto_reload` | Read the auto-reload setting | Any key; read-only |

### Not exposed, on purpose

- **Report files** (`GET /audit/export`): the PDF is binary and an MCP tool result is text.
  The `audit` tool returns the same data as JSON; use the REST API or the Python / Node
  SDK (`audit_export` / `auditExport`) for the file.
- **Turning auto-reload on.** The API has no such endpoint for API keys: it authorizes
  charges, so it is set from the dashboard only. `citation_auto_reload` reads it.
- **Account actions** (`/signup`, `/verify`, `/upgrade`, `/rotate-key`) and the public
  scoreboard opt-out.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `SEO_SCORE_API_KEY` | (none) | Your API key |
| `SEO_SCORE_BASE_URL` | `https://seoscoreapi.com` | API host |
| `SEO_SCORE_DEEP_AUDIT_URL` | `SEO_SCORE_BASE_URL` | Deep Audit host (`POST /site-audit`, `GET /site-audit/{job_id}`, `GET /deep-audit/usage`). `SEO_SCORE_ENGINE_URL` is still read as a fallback; the legacy `https://engine.seoscoreapi.com` keeps working. |

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "seoscoreapi": {
      "command": "npx",
      "args": ["-y", "seoscoreapi-mcp"],
      "env": {
        "SEO_SCORE_API_KEY": "ssa_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the SEO Score tools in the tool picker.

### Claude Code

```bash
claude mcp add seoscoreapi -e SEO_SCORE_API_KEY=ssa_your_key_here -- npx -y seoscoreapi-mcp
```

### Cursor

Open Cursor Settings → MCP Servers → Add a new server with the same JSON shape as Claude Desktop above.

### Windsurf

Settings → Cascade → MCP Servers → paste the same configuration.

### Any other MCP client

Run `npx -y seoscoreapi-mcp` as a stdio transport. The server speaks standard MCP and exposes all tools in the table above.

## Example prompts

Once installed, talk to your AI assistant naturally:

> "Audit https://stripe.com and tell me the top 3 things to fix."

> "Run a batch audit on stripe.com, square.com, and adyen.com, then compare their AI readability scores."

> "What backlinks have we seen pointing at my-startup.com?"

> "Check the score history for our marketing site over the last 30 days."

> "Run a deep audit on my-startup.com as a SaaS site and list the high-severity findings."

> "Run an accessibility audit on our pricing page and list the critical WCAG failures."

> "Crawl my-startup.com and show me the broken links and orphan pages."

> "Build starter prompts for 'SEO audit API', create a citation tracker for Acme, and run it."

The tool the AI picks is shown in your client; you can always ask "what tools did you use?" to see the trace.

## Why MCP?

MCP lets the AI reach data it wouldn't have — your actual site SEO scores, the backlink graph, your monitoring history — without any custom plumbing. Every prompt that says "audit this URL" goes from idea to result in one round-trip. Same source of truth as the REST API; no copying scores between tools.

## Honest framing

The `backlinks` tool returns an **audit-fed sample**, not a comprehensive backlink index. Every response includes a `data_caveat` explaining exactly what the dataset is. We are not Ahrefs and don't pretend to be — we expose the unique, growing graph our customers' audits build for free.

## Source

The MCP server is open source: <https://github.com/avansledright/seoscoreapi.com/tree/main/sdks/mcp>

## License

MIT

<!-- mcp-name: io.github.SeoScoreAPI/seoscoreapi-mcp -->
