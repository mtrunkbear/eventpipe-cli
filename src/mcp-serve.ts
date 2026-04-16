import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readInstalledCliVersion } from "./cli-version.js";

type McpConfig = { apiKey: string; baseUrl: string };

async function loadMcpConfig(): Promise<McpConfig> {
  const envKey = process.env.EVENTPIPE_API_KEY?.trim();
  const envUrl = process.env.EVENTPIPE_BASE_URL?.trim().replace(/\/$/, "");

  if (envKey) {
    return { apiKey: envKey, baseUrl: envUrl || "https://eventpipe.app" };
  }

  const configPath = join(homedir(), ".eventpipe", "mcp.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const data = JSON.parse(raw) as Partial<McpConfig>;
    if (typeof data.apiKey === "string" && data.apiKey.length > 0) {
      return {
        apiKey: data.apiKey,
        baseUrl: envUrl || data.baseUrl?.replace(/\/$/, "") || "https://eventpipe.app",
      };
    }
  } catch {
    /* file missing or unreadable */
  }

  throw new Error(
    "No API key found. Run `eventpipe mcp setup` or set EVENTPIPE_API_KEY.",
  );
}

async function apiFetch(
  cfg: McpConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${cfg.baseUrl}${path}`;
  const headers: Record<string, string> = {
    authorization: `Bearer ${cfg.apiKey}`,
    "content-type": "application/json",
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await res.json().catch(() => null);
  return { status: res.status, data };
}

const DEBUG_LOCAL_GUIDE = `# Debug webhooks locally with Event Pipe

## Quick flow

1. Install CLI: npm install -g @eventpipe/cli
2. Authenticate: eventpipe login
3. Stream events: eventpipe listen <webhookId>
4. Forward to local server: eventpipe listen <webhookId> --forward-to http://127.0.0.1:3000/webhook

## When to use each approach

- **listen** (no --forward-to): inspect payloads in terminal without running a local server.
- **listen --forward-to**: replay real provider traffic to your dev server.
- **execute_pipeline** (MCP tool / API): run the published handler with a synthetic payload — no real provider needed.

## Important: webhook id vs pipeline id

- **Webhook endpoint id** (e.g. "stripe-orders-prod"): used in capture URL and \`listen\`.
- **Pipeline id** (UUID): used in \`eventpipe.json\`, \`push\`, and API routes like /api/account/pipelines/{id}.
They are NOT the same. The pipeline id is shown in Pipe Studio under "IDs for CLI & API".
`;

const IDS_GUIDE = `# Event Pipe identifiers

| Name | Format | Where used |
|------|--------|------------|
| Webhook endpoint id | slug (e.g. "stripe-orders-prod") | Capture URL, Inspector, \`eventpipe listen\` |
| Pipeline id | UUID | \`eventpipe.json\` pipelineId, API /api/account/pipelines/{id}, Pipe Studio |
| Version number | integer (1, 2, …) | Immutable; \`current_version_id\` points to the live one |
| Code node id | UUID or slug | Inside \`settings.pipe.nodes[].id\`; maps to bundled entry files |
| API key | \`evp_…\` string | \`Authorization: Bearer <key>\` or \`X-Api-Key\` header |

## Common mistakes

- Using webhook endpoint id where pipeline id is expected (push, execute).
- Confusing version number with pipeline id.
- Using CLI session token where API key is needed (MCP uses API key, CLI uses session).
`;

export async function startMcpServer(): Promise<void> {
  const cfg = await loadMcpConfig();
  const version = await readInstalledCliVersion().catch(() => "0.0.0");

  const server = new McpServer({
    name: "eventpipe",
    version,
  });

  server.registerTool(
    "list_endpoints",
    {
      title: "List webhook endpoints",
      description:
        "List all webhook endpoints owned by the authenticated account. " +
        "Returns endpoint id (webhookId), label, privacy, and creation date.",
      inputSchema: {},
    },
    async () => {
      const { status, data } = await apiFetch(cfg, "GET", "/api/account/endpoints");
      if (status !== 200) {
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "list_pipelines",
    {
      title: "List pipelines for an endpoint",
      description:
        "List all pipelines (Pipe Studio automations) attached to a webhook endpoint. " +
        "Use the endpointId from list_endpoints.",
      inputSchema: { endpointId: z.string().describe("Webhook endpoint id (slug, not UUID)") },
    },
    async ({ endpointId }) => {
      const { status, data } = await apiFetch(
        cfg,
        "GET",
        `/api/account/pipelines?endpointId=${encodeURIComponent(endpointId)}`,
      );
      if (status !== 200) {
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "get_pipeline",
    {
      title: "Get pipeline details and versions",
      description:
        "Get a pipeline by its UUID, including all published versions and settings.pipe. " +
        "Useful to inspect which version is live and what the handler code looks like.",
      inputSchema: { pipelineId: z.string().uuid().describe("Pipeline UUID") },
    },
    async ({ pipelineId }) => {
      const { status, data } = await apiFetch(
        cfg,
        "GET",
        `/api/account/pipelines/${encodeURIComponent(pipelineId)}`,
      );
      if (status !== 200) {
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "execute_pipeline",
    {
      title: "Execute pipeline with test payload",
      description:
        "Run the current live version of a pipeline with a synthetic payload. " +
        "Returns result, logs, and durationMs. Does NOT create a new version. " +
        "Use this to reproduce failures or verify handler behavior without real provider traffic.",
      inputSchema: {
        pipelineId: z.string().uuid().describe("Pipeline UUID"),
        payload: z.record(z.string(), z.unknown()).describe("JSON body to send as the webhook event"),
        method: z.string().optional().default("POST").describe("HTTP method (default POST)"),
        headers: z.record(z.string(), z.string()).optional().describe("Optional HTTP headers"),
        query: z.record(z.string(), z.string()).optional().describe("Optional query parameters"),
        path: z.string().optional().describe("Optional path"),
      },
    },
    async ({ pipelineId, payload, method, headers, query, path }) => {
      const body: Record<string, unknown> = { payload, method };
      if (headers) body.headers = headers;
      if (query) body.query = query;
      if (path) body.path = path;

      const { status, data } = await apiFetch(
        cfg,
        "POST",
        `/api/account/pipelines/${encodeURIComponent(pipelineId)}/execute`,
        body,
      );
      if (status !== 200) {
        return { content: [{ type: "text" as const, text: JSON.stringify(data) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerResource(
    "debug-local",
    "eventpipe://guide/debug-local",
    {
      title: "Debug webhooks locally",
      description: "Step-by-step guide: listen, forward-to, execute, and when to use each.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, text: DEBUG_LOCAL_GUIDE }],
    }),
  );

  server.registerResource(
    "ids",
    "eventpipe://guide/ids",
    {
      title: "Event Pipe identifiers reference",
      description: "Webhook id vs pipeline id vs version vs code node id — quick reference.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, text: IDS_GUIDE }],
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
