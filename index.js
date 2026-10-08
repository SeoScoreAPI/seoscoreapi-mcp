#!/usr/bin/env node
/**
 * SEO Score API — Model Context Protocol server.
 *
 * Lets MCP-aware clients (Claude Desktop, Claude Code, Cursor, Windsurf,
 * any agent framework) call the SEO Score API directly as tools. The
 * server is a thin shim over our REST API — no logic lives here, all
 * scoring happens server-side at https://seoscoreapi.com.
 *
 * Env:
 *   SEO_SCORE_API_KEY         your API key (paid tools return a 402 message if
 *                             the key's plan doesn't include them)
 *   SEO_SCORE_BASE_URL        API host (default https://seoscoreapi.com)
 *   SEO_SCORE_DEEP_AUDIT_URL  Deep Audit host (default: SEO_SCORE_BASE_URL).
 *                             SEO_SCORE_ENGINE_URL is still read as a fallback.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { TOOLS, VERSION, configFromEnv, createDispatcher, fail } from "./lib.js";

const dispatch = createDispatcher(configFromEnv());

const server = new Server(
  { name: "seoscoreapi", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    return await dispatch(req.params.name, req.params.arguments || {});
  } catch (err) {
    return fail(err);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Stay alive — stdio transport keeps the process running until the
// client disconnects, so we don't need an explicit loop here.
