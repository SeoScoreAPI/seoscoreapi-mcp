/**
 * SEO Score API MCP server: tool definitions and handlers (no transport).
 * index.js wires these to the stdio MCP server; tests import this module directly.
 */

import { readFileSync } from "node:fs";

export const VERSION = "1.5.0";
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

// What the client shows the model at initialize: where to start and how to get a key.
// The hosted server serves the same text (from tools.json's sibling, server-instructions.txt).
export const INSTRUCTIONS = readFileSync(new URL("./server-instructions.txt", import.meta.url), "utf8").trim();

// Tool definitions (name, title, description, inputSchema, outputSchema, annotations)
// live in tools.json, shared with the hosted server at https://seoscoreapi.com/mcp
// (mcp_remote.py in the app reads the same file), so the two never drift.
export const TOOLS = JSON.parse(readFileSync(new URL("./tools.json", import.meta.url), "utf8"));

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
        return ok(`https://seoscoreapi.com/report/${encodeURIComponent(args.domain)}`, "url");
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
        return ok(typeof out.raw === "string" ? out.raw : out, "llms_txt");
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

/**
 * A tool result: the JSON as text (what every client reads) plus structuredContent
 * (an object, as each tool's outputSchema declares). `key` names the field a plain
 * string or array goes under; tools.json's outputSchema documents it.
 */
export function ok(value, key = "result") {
  let structured;
  if (value && typeof value === "object" && !Array.isArray(value)) structured = value;
  else structured = { [key]: value };
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    structuredContent: structured,
  };
}

export function fail(err) {
  return {
    isError: true,
    content: [{ type: "text", text: err.message || String(err) }],
  };
}
