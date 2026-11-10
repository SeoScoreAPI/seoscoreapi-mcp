// Tool metadata quality (1.5.0): tools.json is shared with the hosted server at
// https://seoscoreapi.com/mcp, so directories and clients see the same thing either way.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INSTRUCTIONS, TOOLS, createDispatcher, ok } from "../lib.js";

const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];

test("tools come from tools.json", () => {
  const file = JSON.parse(readFileSync(new URL("../tools.json", import.meta.url), "utf8"));
  assert.deepEqual(TOOLS, file);
  assert.equal(new Set(TOOLS.map((t) => t.name)).size, TOOLS.length);
});

test("every tool has a title, a description, annotations and an outputSchema", () => {
  for (const t of TOOLS) {
    assert.ok(t.title && t.title.length <= 60, `${t.name}: title`);
    assert.ok(t.description.length >= 40 && t.description.length < 4000, `${t.name}: description`);
    for (const h of HINTS) assert.equal(typeof t.annotations[h], "boolean", `${t.name}: ${h}`);
    assert.equal(t.annotations.title, t.title, `${t.name}: annotations.title`);
    if (t.annotations.readOnlyHint) assert.equal(t.annotations.destructiveHint, false, `${t.name}: read-only can't destroy`);
    assert.equal(t.outputSchema.type, "object", `${t.name}: outputSchema`);
  }
});

test("every input property is described and unknown arguments are refused", () => {
  for (const t of TOOLS) {
    assert.equal(t.inputSchema.type, "object");
    assert.equal(t.inputSchema.additionalProperties, false, `${t.name}: additionalProperties`);
    for (const [p, spec] of Object.entries(t.inputSchema.properties || {})) {
      assert.ok(spec.description, `${t.name}.${p}: description`);
      assert.ok(spec.type, `${t.name}.${p}: type`);
    }
    for (const r of t.inputSchema.required || []) assert.ok(r in t.inputSchema.properties, `${t.name}: required ${r}`);
  }
});

test("delete/remove tools are marked destructive", () => {
  for (const t of TOOLS) {
    if (/^(delete|remove)_/.test(t.name)) assert.equal(t.annotations.destructiveHint, true, t.name);
  }
});

test("the dispatcher handles every tool in tools.json", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ job_id: "j", status: "completed", result: {} }) });
  const dispatch = createDispatcher({ apiKey: "k", fetchImpl, pollIntervalMs: 1 });
  for (const t of TOOLS) {
    const args = { url: "https://e.com", urls: ["https://e.com", "https://f.com"], domain: "e.com", job_id: "j",
      tracker_id: 1, run_id: 1, monitor_id: 1, brand: "A", prompt: "p", prompts: ["p"], topic: "t", pack: "500",
      competitor_url: "https://f.com", keyword: "k", csv: "Query\nq" };
    const out = await dispatch(t.name, args);
    assert.ok(out.content[0].text !== undefined, t.name);
    assert.equal(typeof out.structuredContent, "object", `${t.name}: structuredContent`);
  }
});

test("ok() wraps strings under the tool's documented key", () => {
  assert.deepEqual(ok("https://seoscoreapi.com/report/e.com", "url").structuredContent, { url: "https://seoscoreapi.com/report/e.com" });
  assert.deepEqual(ok({ a: 1 }).structuredContent, { a: 1 });
  assert.equal(ok("x", "llms_txt").content[0].text, "x");
});

test("instructions tell a new user where to get a free key", () => {
  assert.match(INSTRUCTIONS, /https:\/\/seoscoreapi\.com\/#signup/);
  assert.match(INSTRUCTIONS, /no card/);
});
