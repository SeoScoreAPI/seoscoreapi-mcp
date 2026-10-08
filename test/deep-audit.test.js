// Deep Audit tools of the MCP server. No network, no MCP SDK: lib.js only.
import test from "node:test";
import assert from "node:assert/strict";
import { TOOLS, configFromEnv, createDispatcher } from "../lib.js";

function fakeFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const impl = async (url, options) => {
    calls.push({ url, options });
    const r = queue.shift();
    return { ok: (r.status || 200) < 400, status: r.status || 200, text: async () => JSON.stringify(r.body ?? {}) };
  };
  return { calls, impl };
}

const parse = (out) => JSON.parse(out.content[0].text);

test("Deep Audit defaults to the main host; legacy env var still honoured", () => {
  assert.equal(configFromEnv({}).deepBase, "https://seoscoreapi.com");
  assert.equal(configFromEnv({ SEO_SCORE_ENGINE_URL: "https://engine.seoscoreapi.com" }).deepBase, "https://engine.seoscoreapi.com");
  assert.equal(
    configFromEnv({ SEO_SCORE_DEEP_AUDIT_URL: "http://localhost:9000/", SEO_SCORE_ENGINE_URL: "https://engine.seoscoreapi.com" }).deepBase,
    "http://localhost:9000",
  );
  assert.equal(configFromEnv({ SEO_SCORE_BASE_URL: "https://staging.example" }).deepBase, "https://staging.example");
});

test("exposes start/get/usage Deep Audit tools", () => {
  const names = TOOLS.map((t) => t.name);
  for (const n of ["deep_audit", "start_deep_audit", "get_deep_audit", "deep_audit_usage"]) assert.ok(names.includes(n), n);
});

test("deep_audit starts and polls on the main host", async () => {
  const f = fakeFetch([{ body: { job_id: "abc" } }, { body: { status: "running" } }, { body: { status: "completed", result: { ok: 1 } } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl, pollIntervalMs: 1 });
  assert.deepEqual(parse(await dispatch("deep_audit", { url: "https://example.com", business_type: "saas" })), { ok: 1 });
  assert.equal(f.calls[0].url, "https://seoscoreapi.com/site-audit");
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { url: "https://example.com", business_type: "saas" });
  assert.equal(f.calls[0].options.headers["X-API-Key"], "k");
  assert.equal(f.calls[2].url, "https://seoscoreapi.com/site-audit/abc");
});

test("deep_audit reports a failed job", async () => {
  const f = fakeFetch([{ body: { job_id: "abc" } }, { body: { status: "failed", error: "boom" } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl, pollIntervalMs: 1 });
  await assert.rejects(dispatch("deep_audit", { url: "https://example.com" }), /boom/);
});

test("start_deep_audit, get_deep_audit and deep_audit_usage", async () => {
  const f = fakeFetch([{ body: { job_id: "abc", status: "queued" } }, { body: { status: "running", progress: 40 } }, { body: { tier: "pro" } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl });
  assert.equal(parse(await dispatch("start_deep_audit", { url: "https://example.com", webhook_url: "https://hook.example/x" })).job_id, "abc");
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { url: "https://example.com", webhook_url: "https://hook.example/x" });
  assert.equal(parse(await dispatch("get_deep_audit", { job_id: "abc" })).progress, 40);
  assert.equal(f.calls[1].url, "https://seoscoreapi.com/site-audit/abc");
  await dispatch("deep_audit_usage", {});
  assert.equal(f.calls[2].url, "https://seoscoreapi.com/deep-audit/usage");
});

test("legacy engine host uses /usage for quota", async () => {
  const f = fakeFetch([{ body: {} }]);
  const dispatch = createDispatcher({ apiKey: "k", deepBase: "https://engine.seoscoreapi.com", fetchImpl: f.impl });
  await dispatch("deep_audit_usage", {});
  assert.equal(f.calls[0].url, "https://engine.seoscoreapi.com/usage");
});

test("HTTP errors carry the API detail", async () => {
  const f = fakeFetch([{ status: 402, body: { detail: "No Deep Audit credits left" } }]);
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl: f.impl });
  await assert.rejects(dispatch("start_deep_audit", { url: "https://example.com" }), /402: No Deep Audit credits/);
});

test("missing API key is a clear error", async () => {
  const dispatch = createDispatcher({ fetchImpl: async () => { throw new Error("should not fetch"); } });
  await assert.rejects(dispatch("deep_audit_usage", {}), /SEO_SCORE_API_KEY/);
});
