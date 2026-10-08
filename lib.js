/**
 * SEO Score API MCP server: tool definitions and handlers (no transport).
 * index.js wires these to the stdio MCP server; tests import this module directly.
 */

export const VERSION = "1.4.0";
export const DEFAULT_BASE = "https://seoscoreapi.com";

// Main host: /deep-audit/usage (its /usage is the per-URL allowance).
// Legacy engine.seoscoreapi.com: /usage.
export function deepAuditUsagePath(base) {
  return base.replace(/^[a-z]+:\/\//i, "").startsWith("engine.") ? "/usage" : "/deep-audit/usage";
}

/** Resolve config from the environment. Deep Audit defaults to the main host. */
export function configFromEnv(env = process.env) {
  const base = (env.SEO_SCORE_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const deepBase = (env.SEO_SCORE_DEEP_AUDIT_URL || env.SEO_SCORE_ENGINE_URL || base).replace(/\/+$/, "");
  return { base, deepBase, apiKey: env.SEO_SCORE_API_KEY || "" };
}

export const TOOLS = [
  {
    name: "audit",
    description:
      "Run a full SEO audit on a URL. Returns score (0-100), letter grade, " +
      "category breakdowns (meta, technical, social, performance, accessibility), " +
      "AI readability score, SXO/AEO/AIO scores (paid plans), and a prioritized " +
      "list of fixes. Usually returns in seconds. Free tier: 2 audits a day. " +
      "Core Web Vitals (LCP, INP, CLS) are not measured unless include_core_web_vitals is true.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to audit. Must include the protocol (https://...)." },
        include_core_web_vitals: {
          type: "boolean",
          default: false,
          description:
            "Also measure Core Web Vitals (LCP, INP, CLS, FCP, TTFB) with Google PageSpeed Insights and return them " +
            "under core_web_vitals. Adds about 10 seconds the first time a URL is measured (cached 24 hours). " +
            "Needs an API key. Leave off unless the user asks about page speed or Core Web Vitals.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "batch_audit",
    description: "Audit multiple URLs in one call. Requires Starter plan ($5/mo) or higher. Returns one audit object per URL.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string" }, description: "URLs to audit (1–10)." },
        include_core_web_vitals: {
          type: "boolean",
          default: false,
          description: "Also measure Core Web Vitals for every URL. Slower: the batch can take a few minutes.",
        },
      },
      required: ["urls"],
    },
  },
  {
    name: "usage",
    description: "Get the current plan, monthly usage, and remaining quota for the API key in use.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "report_url",
    description:
      "Return a public, shareable HTML report URL for a domain. Useful for sending audit results to clients " +
      "without exposing API keys. Format: https://seoscoreapi.com/report/{domain}",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string", description: "Domain (e.g. example.com)." } },
      required: ["domain"],
    },
  },
  {
    name: "add_monitor",
    description: "Add a URL to score monitoring. Re-audits on schedule and alerts via email when the score drops.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        frequency: { type: "string", enum: ["daily", "weekly"], default: "daily" },
      },
      required: ["url"],
    },
  },
  {
    name: "list_monitors",
    description: "List all URLs currently under score monitoring for the active API key.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "history",
    description:
      "Fetch the audit-score history for a URL. Returns a time-series of past scores so you can see trends. " +
      "Requires Starter plan ($5/mo) or higher.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        limit: { type: "integer", default: 100 },
      },
      required: ["url"],
    },
  },
  {
    name: "history_domains",
    description: "List every domain audited by this API key with the latest score and 30-day trend. Starter+.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "backlinks",
    description:
      "Look up observed backlinks for a domain. SEO Score API maintains an audit-fed backlink graph: every audit " +
      "contributes the external links found on the audited page. The dataset is a sample (NOT a comprehensive " +
      "backlink index like Ahrefs) and the response always includes a data_caveat. Coverage grows over time. " +
      "Requires Basic plan ($15/mo) or higher.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Target domain (e.g. example.com)" },
        limit: { type: "integer", default: 50, description: "Max sample rows to return (1-500)" },
      },
      required: ["domain"],
    },
  },
  {
    name: "deep_audit",
    description:
      "Run a Deep Audit — a thorough, AI-assisted SEO audit that scores a URL across 9 dimensions " +
      "(technical, crawlability, content/entity, Core Web Vitals, technical SEO, structured data, security, " +
      "media, off-site): thousands of catalog checks plus up to 150 AI checks. Runs asynchronously server-side; " +
      "this tool waits for the result (about 90 seconds once it starts, longer if queued). Included on Pro " +
      "($39/mo, 20/month) and Ultra ($99/mo, 100/month); other keys spend a purchased Deep Audit credit. " +
      "For long waits use start_deep_audit + get_deep_audit instead.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to audit. Must include the protocol (https://...)." },
        business_type: {
          type: "string",
          description: "Optional: saas | local_service | ecommerce | storefront | blog | publisher — tunes which checks apply.",
        },
        timeout_seconds: { type: "integer", default: 600, description: "How long to wait before giving up (job keeps running)." },
      },
      required: ["url"],
    },
  },
  {
    name: "start_deep_audit",
    description:
      "Queue a Deep Audit and return immediately with a job_id. Poll it with get_deep_audit. Same plans as deep_audit.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to audit. Must include the protocol (https://...)." },
        business_type: {
          type: "string",
          description: "Optional: saas | local_service | ecommerce | storefront | blog | publisher.",
        },
        webhook_url: { type: "string", description: "Optional public URL POSTed once when the job completes." },
      },
      required: ["url"],
    },
  },
  {
    name: "get_deep_audit",
    description:
      "Get a Deep Audit job's status: queued (queue_position, eta_seconds), running (progress 0-100, stage), " +
      "completed (result) or failed (error). Poll every 5-10 seconds.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", description: "The job_id from start_deep_audit." } },
      required: ["job_id"],
    },
  },
  {
    name: "deep_audit_usage",
    description: "Deep Audits used and remaining this calendar month for the API key in use.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "remove_monitor",
    description: "Remove a URL from score monitoring.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "compare",
    description:
      "Compare 2-5 URLs side by side with a structured diff: each URL's score and category breakdown plus who is " +
      "ahead and by how much, per category and per URL pair. Requires Basic plan ($15/mo) or higher.",
    inputSchema: {
      type: "object",
      properties: { urls: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5, description: "2 to 5 URLs." } },
      required: ["urls"],
    },
  },
  {
    name: "competitive_audit",
    description:
      "Head-to-head SEO comparison of your page against a competitor's page with keyword-relevance scoring. " +
      "Requires Pro plan ($39/mo) or higher.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Your page URL." },
        competitor_url: { type: "string", description: "The competitor's page URL." },
        keyword: { type: "string", description: "Target keyword (max 200 characters)." },
      },
      required: ["url", "competitor_url", "keyword"],
    },
  },
  {
    name: "accessibility_audit",
    description:
      "Run an ADA / WCAG 2.1 AA accessibility audit (axe-core). Paid plans only. Returns the compliance score and " +
      "grade, lawsuit risk (high/medium/low/minimal), category breakdowns, violations (WCAG 2.1 AA failures with " +
      "affected elements and a plain-English fix), best_practices (not WCAG requirements; they never lower the " +
      "score), needs_review and priorities. ADA audits have their own monthly allowance, separate from the audit " +
      "quota (the usage tool reports ada_remaining). Each key may run 2 at a time; a 429 is not counted.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to audit. Must include the protocol (https://...)." },
        include_trackers: { type: "boolean", description: "Also add the tracker and pixel inventory to the report." },
      },
      required: ["url"],
    },
  },
  {
    name: "ai_readability",
    description: "Score how well a page can be consumed by AI/LLM systems. Counts as one audit.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "trackers",
    description:
      "List the third-party trackers and pixels a page loads (analytics, advertising, session replay, chat, " +
      "marketing automation, A/B testing, monitoring), including pixels a tag manager injects. Loads the page in a " +
      "real browser with no interaction; it does not determine whether a tracker waited for consent, and it is not " +
      "legal advice. Counts as one audit; a page that can't be loaded is not counted.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "conversion",
    description:
      "Score how well a page turns a visitor into a lead or a sale: headline, call to action, trust, forms and " +
      "objections, each 0-100, with a prioritized fix list. It does not measure the actual conversion rate. Counts " +
      "as one audit. Free keys get the scores and the first two priorities; paid plans get the full list.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        page_type: {
          type: "string",
          enum: ["local_service", "ecommerce", "saas", "general"],
          description: "Detected from the page when omitted.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "quick_wins",
    description:
      "Find the page-2 quick wins in the user's own Google Search Console data: queries ranking 11-20 worth working " +
      "on first, each with an opportunity score and an estimate of the extra clicks from moving onto page 1. The " +
      "API does not connect to Search Console: pass the exported rows or the CSV export text. Nothing is stored. " +
      "The click numbers are estimates. Works on every plan; counts as one audit. Up to 1 MB per request.",
    inputSchema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: { type: "object" },
          description: "Rows like {query, page, clicks, impressions, position}. `page` is optional.",
        },
        csv: { type: "string", description: "The Performance export as text, with a header row. Use instead of rows." },
        min_impressions: { type: "integer", description: "Default 50." },
        target_position: { type: "integer", description: "1-10, default 5." },
        limit: { type: "integer", description: "Default 25, max 200." },
        exclude_terms: { type: "array", items: { type: "string" }, description: "Words to leave out, such as the brand name." },
      },
    },
  },
  {
    name: "llms_txt",
    description:
      "Generate an llms.txt file for a domain and return its text, ready to save at /llms.txt. Basic plan ($15/mo) " +
      "and higher get the curated version with per-page descriptions; other keys (or no key) get the basic version.",
    inputSchema: {
      type: "object",
      properties: { domain: { type: "string", description: "Domain (e.g. example.com)." } },
      required: ["domain"],
    },
  },
  {
    name: "geo_audit",
    description:
      "Run a GEO (Generative Engine Optimization) audit: 26 checks measuring how visible a page is to LLMs. " +
      "Requires Basic plan ($15/mo) or higher; uses the plan's monthly GEO allowance.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "geo_brand_probe",
    description:
      "Probe LLMs to measure how often a brand is mentioned in AI responses. Requires Basic plan ($15/mo) or " +
      "higher; uses the plan's monthly GEO allowance. Can take a while.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        domain: { type: "string", description: "The brand's domain (e.g. mybrand.com)." },
        prompts: { type: "array", items: { type: "string" }, description: "Questions to ask, e.g. \"What are the best X?\"" },
        models: { type: "array", items: { type: "string" }, description: "Optional, e.g. [\"claude\", \"nova\"]." },
        runs_per_prompt: { type: "integer", description: "Default 3." },
      },
      required: ["brand", "domain", "prompts"],
    },
  },
  {
    name: "add_geo_monitor",
    description: "Create a GEO monitor for a URL. Requires Basic plan or higher (the Basic plan runs weekly).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        frequency: { type: "string", enum: ["daily", "weekly"], default: "weekly" },
        alert_threshold: { type: "integer", default: -5 },
        webhook_url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "list_geo_monitors",
    description: "List the active GEO monitors for the API key in use.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "geo_monitor_history",
    description: "Score history for a GEO monitor.",
    inputSchema: {
      type: "object",
      properties: {
        monitor_id: { type: "integer", description: "The monitor's id from list_geo_monitors." },
        page: { type: "integer", default: 1 },
        per_page: { type: "integer", default: 20, description: "1-100." },
      },
      required: ["monitor_id"],
    },
  },
  {
    name: "remove_geo_monitor",
    description: "Remove a GEO monitor by URL.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "crawl_site",
    description:
      "Crawl one site and wait for the result: follows same-site links plus the sitemap and reports broken pages, " +
      "redirects, duplicate titles and headings, pages missing a title or heading, orphan pages and slow pages. " +
      "Pro: 25 pages per crawl, 20 crawls a month. Ultra: 100 pages, 100 crawls a month. Any other plan: one Deep " +
      "Audit credit covers a 25-page crawl. A failed crawl is not counted. For long waits use start_crawl + get_crawl.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Where to start (e.g. https://example.com)." },
        max_pages: { type: "integer", description: "Fewer pages than the plan's cap (1-100)." },
        timeout_seconds: { type: "integer", default: 600, description: "How long to wait before giving up (the crawl keeps running)." },
      },
      required: ["url"],
    },
  },
  {
    name: "start_crawl",
    description: "Start a site crawl and return immediately with a job_id and a shareable site_map link. Poll it with get_crawl. Same plans as crawl_site.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        max_pages: { type: "integer", description: "Fewer pages than the plan's cap (1-100)." },
      },
      required: ["url"],
    },
  },
  {
    name: "get_crawl",
    description:
      "Get a site crawl's status: queued, running (pages_done counts up), completed (result: summary, issues, " +
      "pages, links) or failed (error). Only the key that started a crawl can read it.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", description: "The job_id from start_crawl." } },
      required: ["job_id"],
    },
  },
  {
    name: "citation_starter_prompts",
    description:
      "Build a starter set of prompts to track for AI citations, from a topic plus optional brand, competitors and " +
      "audience. Fixed templates, not a model: no AI check is spent. Works on every plan and is not metered. " +
      "Returns `prompts`, ready to pass to create_citation_tracker.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "What you sell, as a buyer would type it, singular (e.g. \"SEO audit API\")." },
        brand: { type: "string" },
        competitors: { type: "array", items: { type: "string" }, description: "Up to 5 competitor names." },
        audience: { type: "string", description: "Who buys it, plural (e.g. \"marketing agencies\")." },
        features: { type: "array", items: { type: "string" }, description: "Up to 6 features buyers ask about." },
        use_cases: { type: "array", items: { type: "string" }, description: "Up to 6 jobs it is bought for." },
        per_category: { type: "integer", description: "Prompts per category, 1-10 (default 2 = 12 prompts)." },
        limit: { type: "integer", description: "Cut the list to this many (1-60)." },
      },
      required: ["topic"],
    },
  },
  {
    name: "citation_suggest_prompts",
    description: "Suggest AI-citation prompts to track, read off what a site says it does.",
    inputSchema: { type: "object", properties: { domain: { type: "string" } }, required: ["domain"] },
  },
  {
    name: "create_citation_tracker",
    description:
      "Track a brand's visibility in AI answers (ChatGPT, Gemini, Perplexity, Claude): mention rate, citation rate, " +
      "share of voice and position over time. Requires Starter ($5/mo) or higher. Monthly allowance (checks / " +
      "tracked prompts): Starter 150 / 15, Basic 500 / 30, Pro 1,500 / 75, Ultra 4,000 / 200. A check is one " +
      "prompt on one engine, sampled once. With no prompts, pass `starter` and a starter set is generated to fit the plan.",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        domains: { type: "array", items: { type: "string" }, description: "The brand's domains (e.g. [\"acme.com\"])." },
        prompts: { type: "array", items: { type: "string" }, description: "The questions buyers type." },
        starter: {
          type: "object",
          description: "Use instead of prompts: {topic, audience?}.",
          properties: { topic: { type: "string" }, audience: { type: "string" } },
        },
        competitors: { type: "array", items: { type: "string" } },
        engines: { type: "array", items: { type: "string", enum: ["chatgpt", "gemini", "perplexity", "claude"] } },
        samples: { type: "integer", description: "Samples per prompt per engine." },
        cadence: { type: "string", enum: ["daily", "weekly", "monthly", "manual"] },
        webhook_url: { type: "string", description: "https URL." },
      },
      required: ["brand"],
    },
  },
  {
    name: "list_citation_trackers",
    description:
      "List the key's citation trackers plus `usage`: the month's checks (limit, used, remaining), the top-up " +
      "balance and checks_available (what a run can spend now).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_citation_tracker",
    description: "Read one citation tracker.",
    inputSchema: { type: "object", properties: { tracker_id: { type: "integer" } }, required: ["tracker_id"] },
  },
  {
    name: "update_citation_tracker",
    description: "Edit a citation tracker's prompts, engines, competitors, samples, cadence or webhook. Only the fields passed change.",
    inputSchema: {
      type: "object",
      properties: {
        tracker_id: { type: "integer" },
        prompts: { type: "array", items: { type: "string" } },
        engines: { type: "array", items: { type: "string", enum: ["chatgpt", "gemini", "perplexity", "claude"] } },
        competitors: { type: "array", items: { type: "string" } },
        samples: { type: "integer" },
        cadence: { type: "string", enum: ["daily", "weekly", "monthly", "manual"] },
        webhook_url: { type: "string" },
      },
      required: ["tracker_id"],
    },
  },
  {
    name: "delete_citation_tracker",
    description: "Stop tracking a brand. Run history is kept until its retention expires.",
    inputSchema: { type: "object", properties: { tracker_id: { type: "integer" } }, required: ["tracker_id"] },
  },
  {
    name: "run_citation_tracker",
    description:
      "Run a citation tracker now. Every prompt x engine x sample counts as one check. A run needs all of its " +
      "checks up front (the month's remaining allowance plus any top-up balance); if that is short the run is " +
      "refused and nothing is spent. A check whose engine returned an error is not counted.",
    inputSchema: { type: "object", properties: { tracker_id: { type: "integer" } }, required: ["tracker_id"] },
  },
  {
    name: "get_citation_run",
    description: "A citation run's status plus every per-prompt, per-engine result.",
    inputSchema: { type: "object", properties: { run_id: { type: "integer" } }, required: ["run_id"] },
  },
  {
    name: "citation_tracker_history",
    description: "Timeseries of mention rate, citation rate, share of voice and average position for a citation tracker.",
    inputSchema: {
      type: "object",
      properties: { tracker_id: { type: "integer" }, days: { type: "integer", default: 90, description: "1-365." } },
      required: ["tracker_id"],
    },
  },
  {
    name: "citation_check",
    description:
      "One-off AI citation check for a brand and one prompt: no tracker, metered per check (one check per engine " +
      "per sample). Paid plans only (Starter and up).",
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        prompt: { type: "string" },
        domains: { type: "array", items: { type: "string" } },
        engines: { type: "array", items: { type: "string", enum: ["chatgpt", "gemini", "perplexity", "claude"] } },
        samples: { type: "integer", description: "Default 1." },
        competitors: { type: "array", items: { type: "string" } },
      },
      required: ["brand", "prompt"],
    },
  },
  {
    name: "citation_topups",
    description:
      "Top-up packs for AI citation checks (`packs` is the live list with prices) and this account's balance. " +
      "Top-up checks are spent only after the plan's monthly allowance, do not reset on the 1st, and expire 12 " +
      "months after purchase. `can_buy` is false on the free tier.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "citation_topup_checkout",
    description:
      "Create a one-time Stripe Checkout link for a pack of top-up citation checks and return its URL. Paid plans " +
      "only. This charges nothing: the user must open the link and pay by card, and the checks are added when the " +
      "payment completes. Get the pack keys and prices from citation_topups first.",
    inputSchema: {
      type: "object",
      properties: { pack: { type: "string", description: "A pack `key` from citation_topups (e.g. \"500\")." } },
      required: ["pack"],
    },
  },
  {
    name: "citation_auto_reload",
    description:
      "Read the auto-reload setting for AI citation checks and this month's reloads and charges. Read-only: " +
      "auto-reload is off unless the account owner turns it on, and it can only be turned on or changed from the " +
      "dashboard (signed in), never through the API or this server, because turning it on authorizes charges.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── Tool handlers ──────────────────────────────────────────────────────────

export function createDispatcher({
  base = DEFAULT_BASE,
  deepBase = base,
  apiKey = "",
  fetchImpl = globalThis.fetch,
  pollIntervalMs = 5000,
} = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function call(method, path, { body, requireKey = true, host = base } = {}) {
    const headers = { "Content-Type": "application/json", "User-Agent": `seoscoreapi-mcp/${VERSION}` };
    if (requireKey) {
      if (!apiKey) {
        throw new Error(
          "SEO_SCORE_API_KEY env var is not set. Get a free key at https://seoscoreapi.com/#signup",
        );
      }
      headers["X-API-Key"] = apiKey;
    }
    const res = await fetchImpl(`${host}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    if (!res.ok) {
      const detail = payload.detail || payload.error || text;
      const err = new Error(`HTTP ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
      err.status = res.status;
      throw err;
    }
    return payload;
  }

  // Query string from an object, skipping unset values; arrays are comma-joined.
  function qs(params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      q.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    const out = q.toString();
    return out ? `?${out}` : "";
  }

  // The named args that were actually passed, as a request body.
  function pick(args, keys) {
    const body = {};
    for (const k of keys) if (args[k] !== undefined && args[k] !== null) body[k] = args[k];
    return body;
  }

  const id = (v) => encodeURIComponent(v);

  function deepBody(args) {
    const body = { url: args.url };
    if (args.business_type) body.business_type = args.business_type;
    if (args.webhook_url) body.webhook_url = args.webhook_url;
    return body;
  }

  return async function dispatch(name, args = {}) {
    switch (name) {
      case "audit": {
        const u = encodeURIComponent(args.url);
        // Demo endpoint when no key, full /audit when key present.
        if (!apiKey) return ok(await call("GET", `/demo-audit?url=${u}`, { requireKey: false }));
        const cwv = args.include_core_web_vitals === true ? "&cwv=true" : "";
        return ok(await call("GET", `/audit?url=${u}${cwv}`));
      }
      case "batch_audit":
        return ok(await call("POST", "/audit/batch", {
          body: args.include_core_web_vitals === true ? { urls: args.urls, cwv: true } : { urls: args.urls },
        }));
      case "usage":
        return ok(await call("GET", "/usage"));
      case "report_url":
        return ok(`https://seoscoreapi.com/report/${encodeURIComponent(args.domain)}`);
      case "add_monitor":
        return ok(await call("POST", "/monitors", { body: { url: args.url, frequency: args.frequency || "daily" } }));
      case "list_monitors":
        return ok(await call("GET", "/monitors"));
      case "history": {
        const u = encodeURIComponent(args.url);
        const limit = args.limit || 100;
        return ok(await call("GET", `/history?url=${u}&limit=${limit}`));
      }
      case "history_domains":
        return ok(await call("GET", "/history/domains"));
      case "deep_audit": {
        const job = await call("POST", "/site-audit", { host: deepBase, body: deepBody({ url: args.url, business_type: args.business_type }) });
        const timeoutS = Number(args.timeout_seconds) || 600;
        const deadline = Date.now() + timeoutS * 1000;
        for (;;) {
          if (Date.now() > deadline) {
            throw new Error(`Deep audit still running after ${timeoutS}s; check it later with get_deep_audit job_id=${job.job_id}`);
          }
          await sleep(pollIntervalMs);
          const s = await call("GET", `/site-audit/${encodeURIComponent(job.job_id)}`, { host: deepBase });
          if (s.status === "completed") return ok(s.result);
          if (s.status === "failed") throw new Error(s.error || "Deep audit failed");
        }
      }
      case "start_deep_audit":
        return ok(await call("POST", "/site-audit", { host: deepBase, body: deepBody(args) }));
      case "get_deep_audit":
        return ok(await call("GET", `/site-audit/${encodeURIComponent(args.job_id)}`, { host: deepBase }));
      case "deep_audit_usage":
        return ok(await call("GET", deepAuditUsagePath(deepBase), { host: deepBase }));
      case "backlinks": {
        const d = encodeURIComponent(args.domain);
        const limit = args.limit || 50;
        return ok(await call("GET", `/backlinks?domain=${d}&limit=${limit}`));
      }
      case "remove_monitor":
        return ok(await call("DELETE", "/monitors", { body: { url: args.url } }));
      case "compare":
        return ok(await call("POST", "/compare", { body: { urls: args.urls } }));
      case "competitive_audit":
        return ok(await call("POST", "/audit/competitive", { body: pick(args, ["url", "competitor_url", "keyword"]) }));
      case "accessibility_audit":
        return ok(await call("GET", `/audit/accessibility${qs({ url: args.url, include: args.include_trackers ? "trackers" : undefined })}`));
      case "ai_readability":
        return ok(await call("GET", `/ai-readability${qs({ url: args.url })}`));
      case "trackers":
        return ok(await call("GET", `/trackers${qs({ url: args.url })}`));
      case "conversion":
        return ok(await call("GET", `/conversion${qs({ url: args.url, page_type: args.page_type })}`));
      case "quick_wins": {
        if (args.rows === undefined && args.csv === undefined) throw new Error("Pass rows or csv");
        const body = pick(args, ["rows", "csv", "min_impressions", "target_position", "limit", "exclude_terms"]);
        return ok(await call("POST", "/quick-wins", { body }));
      }
      case "llms_txt": {
        const out = await call("GET", `/llms-generator${qs({ domain: args.domain })}`, { requireKey: Boolean(apiKey) });
        return ok(typeof out.raw === "string" ? out.raw : out);
      }
      case "geo_audit":
        return ok(await call("GET", `/geo/audit${qs({ url: args.url })}`));
      case "geo_brand_probe":
        return ok(await call("POST", "/geo/brand-probe", { body: pick(args, ["brand", "domain", "prompts", "models", "runs_per_prompt"]) }));
      case "add_geo_monitor":
        return ok(await call("POST", "/geo/monitor", { body: pick(args, ["url", "frequency", "alert_threshold", "webhook_url"]) }));
      case "list_geo_monitors":
        return ok(await call("GET", "/geo/monitors"));
      case "geo_monitor_history":
        return ok(await call("GET", `/geo/monitor/${id(args.monitor_id)}/history${qs({ page: args.page, per_page: args.per_page })}`));
      case "remove_geo_monitor":
        return ok(await call("DELETE", "/geo/monitor", { body: { url: args.url } }));
      case "crawl_site": {
        const job = await call("POST", "/crawl", { body: pick(args, ["url", "max_pages"]) });
        const timeoutS = Number(args.timeout_seconds) || 600;
        const deadline = Date.now() + timeoutS * 1000;
        for (;;) {
          if (Date.now() > deadline) {
            throw new Error(`Crawl still running after ${timeoutS}s; check it later with get_crawl job_id=${job.job_id}`);
          }
          await sleep(pollIntervalMs);
          const s = await call("GET", `/crawl/${id(job.job_id)}`);
          if (s.status === "completed") return ok(s);
          if (s.status === "failed") throw new Error(s.error || "Crawl failed");
        }
      }
      case "start_crawl":
        return ok(await call("POST", "/crawl", { body: pick(args, ["url", "max_pages"]) }));
      case "get_crawl":
        return ok(await call("GET", `/crawl/${id(args.job_id)}`));
      case "citation_starter_prompts":
        return ok(await call("GET", `/citations/prompts/starter${qs(pick(args, ["topic", "brand", "competitors", "audience", "features", "use_cases", "per_category", "limit"]))}`));
      case "citation_suggest_prompts":
        return ok(await call("GET", `/citations/prompts/suggest${qs({ domain: args.domain })}`));
      case "create_citation_tracker":
        return ok(await call("POST", "/citations/trackers", {
          body: pick(args, ["brand", "domains", "prompts", "starter", "competitors", "engines", "samples", "cadence", "webhook_url"]),
        }));
      case "list_citation_trackers":
        return ok(await call("GET", "/citations/trackers"));
      case "get_citation_tracker":
        return ok(await call("GET", `/citations/trackers/${id(args.tracker_id)}`));
      case "update_citation_tracker":
        return ok(await call("PATCH", `/citations/trackers/${id(args.tracker_id)}`, {
          body: pick(args, ["prompts", "engines", "competitors", "samples", "cadence", "webhook_url"]),
        }));
      case "delete_citation_tracker":
        return ok(await call("DELETE", `/citations/trackers/${id(args.tracker_id)}`));
      case "run_citation_tracker":
        return ok(await call("POST", `/citations/trackers/${id(args.tracker_id)}/run`));
      case "get_citation_run":
        return ok(await call("GET", `/citations/runs/${id(args.run_id)}`));
      case "citation_tracker_history":
        return ok(await call("GET", `/citations/trackers/${id(args.tracker_id)}/history${qs({ days: args.days })}`));
      case "citation_check":
        return ok(await call("POST", "/citations/check", {
          body: pick(args, ["brand", "prompt", "domains", "engines", "samples", "competitors"]),
        }));
      case "citation_topups":
        return ok(await call("GET", "/citations/topups"));
      case "citation_topup_checkout":
        return ok(await call("POST", "/citations/topups/checkout", { body: { pack: String(args.pack) } }));
      case "citation_auto_reload":
        return ok(await call("GET", "/citations/auto-reload"));
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };
}

export function ok(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

export function fail(err) {
  return {
    isError: true,
    content: [{ type: "text", text: err.message || String(err) }],
  };
}
