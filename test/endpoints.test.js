// Tools added in 1.3.0. No network, no MCP SDK: lib.js only.
import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS, VERSION, createDispatcher } from "../lib.js";

const B = "https://seoscoreapi.com";

function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const r = queue.shift() ?? { body: {} };
    return {
      ok: (r.status || 200) < 400,
      status: r.status || 200,
      text: async () => (r.text !== undefined ? r.text : JSON.stringify(r.body ?? {})),
    };
  };
  return { calls, impl };
}

const parse = (out) => JSON.parse(out.content[0].text);
const q = (params) => `?${new URLSearchParams(params).toString()}`;

// [tool, args, method, path (with query), expected JSON body]
const CASES = [
  ["remove_monitor", { url: "https://e.com" }, "DELETE", "/monitors", { url: "https://e.com" }],
  ["compare", { urls: ["https://a.com", "https://b.com"] }, "POST", "/compare", { urls: ["https://a.com", "https://b.com"] }],
  ["competitive_audit", { url: "https://a.com", competitor_url: "https://b.com", keyword: "crm" }, "POST", "/audit/competitive",
    { url: "https://a.com", competitor_url: "https://b.com", keyword: "crm" }],
  ["accessibility_audit", { url: "https://e.com" }, "GET", `/audit/accessibility${q({ url: "https://e.com" })}`],
  ["accessibility_audit", { url: "https://e.com", include_trackers: true }, "GET",
    `/audit/accessibility${q({ url: "https://e.com", include: "trackers" })}`],
  ["ai_readability", { url: "https://e.com" }, "GET", `/ai-readability${q({ url: "https://e.com" })}`],
  ["trackers", { url: "https://e.com" }, "GET", `/trackers${q({ url: "https://e.com" })}`],
  ["conversion", { url: "https://e.com", page_type: "saas" }, "GET", `/conversion${q({ url: "https://e.com", page_type: "saas" })}`],
  ["quick_wins", { csv: "Query,Clicks\nq,1", limit: 5 }, "POST", "/quick-wins", { csv: "Query,Clicks\nq,1", limit: 5 }],
  ["geo_audit", { url: "https://e.com" }, "GET", `/geo/audit${q({ url: "https://e.com" })}`],
  ["geo_brand_probe", { brand: "Acme", domain: "acme.com", prompts: ["p"] }, "POST", "/geo/brand-probe",
    { brand: "Acme", domain: "acme.com", prompts: ["p"] }],
  ["add_geo_monitor", { url: "https://e.com", frequency: "weekly" }, "POST", "/geo/monitor", { url: "https://e.com", frequency: "weekly" }],
  ["list_geo_monitors", {}, "GET", "/geo/monitors"],
  ["geo_monitor_history", { monitor_id: 7, page: 2 }, "GET", `/geo/monitor/7/history${q({ page: 2 })}`],
  ["remove_geo_monitor", { url: "https://e.com" }, "DELETE", "/geo/monitor", { url: "https://e.com" }],
  ["start_crawl", { url: "https://e.com", max_pages: 10 }, "POST", "/crawl", { url: "https://e.com", max_pages: 10 }],
  ["get_crawl", { job_id: "abc" }, "GET", "/crawl/abc"],
  ["citation_starter_prompts", { topic: "CRM", competitors: ["A", "B"], limit: 15 }, "GET",
    `/citations/prompts/starter${q({ topic: "CRM", competitors: "A,B", limit: 15 })}`],
  ["citation_suggest_prompts", { domain: "e.com" }, "GET", `/citations/prompts/suggest${q({ domain: "e.com" })}`],
  ["create_citation_tracker", { brand: "Acme", starter: { topic: "CRM" } }, "POST", "/citations/trackers",
    { brand: "Acme", starter: { topic: "CRM" } }],
  ["list_citation_trackers", {}, "GET", "/citations/trackers"],
  ["get_citation_tracker", { tracker_id: 3 }, "GET", "/citations/trackers/3"],
  ["update_citation_tracker", { tracker_id: 3, cadence: "monthly" }, "PATCH", "/citations/trackers/3", { cadence: "monthly" }],
  ["delete_citation_tracker", { tracker_id: 3 }, "DELETE", "/citations/trackers/3"],
  ["run_citation_tracker", { tracker_id: 3 }, "POST", "/citations/trackers/3/run"],
  ["get_citation_run", { run_id: 9 }, "GET", "/citations/runs/9"],
  ["citation_tracker_history", { tracker_id: 3, days: 30 }, "GET", `/citations/trackers/3/history${q({ days: 30 })}`],
  ["citation_check", { brand: "Acme", prompt: "best crm", engines: ["chatgpt"] }, "POST", "/citations/check",
    { brand: "Acme", prompt: "best crm", engines: ["chatgpt"] }],
  ["citation_topups", {}, "GET", "/citations/topups"],
  ["citation_topup_checkout", { pack: 500 }, "POST", "/citations/topups/checkout", { pack: "500" }],
  ["citation_auto_reload", {}, "GET", "/citations/auto-reload"],
];

for (const [tool, args, method, path, body] of CASES) {
  test(`${tool} -> ${method} ${path.split("?")[0]}${args.include_trackers ? " (trackers)" : ""}`, async () => {
    const f = fakeFetch([{ body: { ok: 1 } }]);
    const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl });
    assert.deepEqual(parse(await dispatch(tool, args)), { ok: 1 });
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, B + path);
    assert.equal(f.calls[0].options.method, method);
    assert.equal(f.calls[0].options.headers["X-API-Key"], "k");
    assert.equal(f.calls[0].options.headers["User-Agent"], `seoscoreapi-mcp/${VERSION}`);
    if (body === undefined) assert.equal(f.calls[0].options.body, undefined);
    else assert.deepEqual(JSON.parse(f.calls[0].options.body), body);
  });
}

test("every tool has a handler and every tested tool is listed", async () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "duplicate tool name");
  for (const [tool] of CASES) assert.ok(names.includes(tool), tool);
  // Every response is a finished job, so the waiting tools return on their first poll.
  const impl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ job_id: "abc", status: "completed", result: {} }) });
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: impl, pollIntervalMs: 1 });
  for (const t of TOOLS) {
    // Unknown tools throw "Unknown tool"; anything else (a result or an argument error) means a handler exists.
    await dispatch(t.name, { url: "https://e.com", rows: [] }).catch((e) => assert.doesNotMatch(e.message, /Unknown tool/, t.name));
  }
});

test("every tool has a description and an object input schema", () => {
  for (const t of TOOLS) {
    assert.ok(t.description && t.description.length > 10, t.name);
    assert.equal(t.inputSchema.type, "object", t.name);
  }
});

test("auto-reload is read-only and file export is not a tool", () => {
  const names = TOOLS.map((t) => t.name);
  assert.deepEqual(names.filter((n) => /auto_reload/.test(n)), ["citation_auto_reload"]);
  assert.ok(!names.some((n) => /export/.test(n)));
});

test("llms_txt returns the plain text and works without a key", async () => {
  const f = fakeFetch([{ text: "# Example\n\n- [Home](https://e.com)" }]);
  const dispatch = createDispatcher({ fetchImpl: f.impl });
  const out = await dispatch("llms_txt", { domain: "e.com" });
  assert.equal(out.content[0].text, "# Example\n\n- [Home](https://e.com)");
  assert.equal(f.calls[0].url, `${B}/llms-generator?domain=e.com`);
  assert.equal(f.calls[0].options.headers["X-API-Key"], undefined);
});

test("llms_txt sends the key when there is one", async () => {
  const f = fakeFetch([{ text: "x" }]);
  await createDispatcher({ apiKey: "k", fetchImpl: f.impl })("llms_txt", { domain: "e.com" });
  assert.equal(f.calls[0].options.headers["X-API-Key"], "k");
});

test("quick_wins needs rows or csv", async () => {
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: async () => { throw new Error("should not fetch"); } });
  await assert.rejects(dispatch("quick_wins", { limit: 5 }), /rows or csv/);
});

test("crawl_site starts, polls and returns the completed job", async () => {
  const f = fakeFetch([
    { body: { job_id: "abc", status: "queued" } },
    { body: { status: "running", pages_done: 3 } },
    { body: { status: "completed", site_map: "m", result: { summary: {} } } },
  ]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl, pollIntervalMs: 1 });
  const out = parse(await dispatch("crawl_site", { url: "https://e.com", max_pages: 5 }));
  assert.deepEqual(out.result, { summary: {} });
  assert.equal(out.site_map, "m");
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { url: "https://e.com", max_pages: 5 });
  assert.equal(f.calls[2].url, `${B}/crawl/abc`);
});

test("crawl_site reports a failed crawl", async () => {
  const f = fakeFetch([{ body: { job_id: "abc" } }, { body: { status: "failed", error: "boom" } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl, pollIntervalMs: 1 });
  await assert.rejects(dispatch("crawl_site", { url: "https://e.com" }), /boom/);
});

test("API refusals carry the detail", async () => {
  const f = fakeFetch([{ status: 429, body: { detail: "Citation check limit reached" } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl });
  await assert.rejects(dispatch("run_citation_tracker", { tracker_id: 3 }), /429: Citation check limit reached/);
});

// --- Core Web Vitals opt-in (1.4.0) ---

test("audit and batch_audit expose include_core_web_vitals, default false", () => {
  for (const name of ["audit", "batch_audit"]) {
    const prop = TOOLS.find((t) => t.name === name).inputSchema.properties.include_core_web_vitals;
    assert.equal(prop.type, "boolean");
    assert.equal(prop.default, false);
    assert.ok(!TOOLS.find((t) => t.name === name).inputSchema.required.includes("include_core_web_vitals"));
  }
});

test("audit sends cwv=true only when asked", async () => {
  const f = fakeFetch([{ body: { score: 90 } }, { body: { score: 90 } }, { body: { score: 90 } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl });
  await dispatch("audit", { url: "https://e.com" });
  await dispatch("audit", { url: "https://e.com", include_core_web_vitals: false });
  await dispatch("audit", { url: "https://e.com", include_core_web_vitals: true });
  const plain = `${B}/audit?url=${encodeURIComponent("https://e.com")}`;
  assert.equal(f.calls[0].url, plain);
  assert.equal(f.calls[1].url, plain);
  assert.equal(f.calls[2].url, `${plain}&cwv=true`);
});

test("the keyless demo audit never asks for Core Web Vitals", async () => {
  const f = fakeFetch([{ body: { score: 90 } }]);
  const dispatch = createDispatcher({ apiKey: "", fetchImpl: f.impl });
  await dispatch("audit", { url: "https://e.com", include_core_web_vitals: true });
  assert.equal(f.calls[0].url, `${B}/demo-audit?url=${encodeURIComponent("https://e.com")}`);
});

test("batch_audit sends cwv only when asked", async () => {
  const f = fakeFetch([{ body: {} }, { body: {} }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl });
  await dispatch("batch_audit", { urls: ["https://a.com"] });
  await dispatch("batch_audit", { urls: ["https://a.com"], include_core_web_vitals: true });
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { urls: ["https://a.com"] });
  assert.deepEqual(JSON.parse(f.calls[1].options.body), { urls: ["https://a.com"], cwv: true });
});
