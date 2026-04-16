---
name: eventpipe-debug
description: Debugs Event Pipe webhooks and pipelines using the official CLI (listen, forward-to, build, push), the dashboard HTTP API (execute, versions), and the built-in MCP server (list_endpoints, list_pipelines, get_pipeline, execute_pipeline). Use when the user works with eventpipe, webhook capture, Pipe Studio, pipelines, handler bundles, or asks to debug or trace webhook traffic locally.
---

# Event Pipe — debug and tooling

## Mental model

- **Webhook endpoint id** (`webhookId`): public capture URL segment; used with `eventpipe listen <webhookId>` and the Inspector.
- **Pipeline id** (`pipelineId`): UUID for Pipe Studio / `eventpipe.json`; **not** the same as `webhookId`. Publishing uses the pipeline id.
- Traffic hits the **cloud** first; `listen` streams events to the CLI via the relay. **`--forward-to`** replays each captured request to a local URL (your dev server).

## MCP tools (preferred when available)

If the Event Pipe MCP server is active (configured via `eventpipe mcp setup`), use these tools:

| Tool | Purpose |
|------|---------|
| `list_endpoints` | List all webhook endpoints for the account. |
| `list_pipelines` | List pipelines attached to a webhook endpoint (pass `endpointId`). |
| `get_pipeline` | Get pipeline details, versions, and `settings.pipe` (pass `pipelineId` UUID). |
| `execute_pipeline` | Run the live version with a test payload — returns `result`, `logs`, `durationMs`. |
| `list_executions` | Recent executions for a pipeline (status, duration, errors). |
| `get_execution` | Full execution details: logs, output, error, duration. |
| `get_request_executions` | All executions triggered by a specific inbound webhook request. |

MCP resources: `eventpipe://guide/debug-local` and `eventpipe://guide/ids` for quick reference.

## CLI (after `eventpipe login`)

| Command | Purpose |
|--------|---------|
| `eventpipe listen <webhookId>` | Stream captured webhooks as JSON (use `--verbose` for full event). |
| `eventpipe listen <webhookId> --forward-to http://127.0.0.1:3000/path` | Same, plus HTTP replay to localhost (forward status on stderr). |
| `eventpipe build` | Bundle TypeScript to `.eventpipe/` (requires `eventpipe.json` with `settings.pipe` v3). |
| `eventpipe push` | Build and publish a new pipeline version (same route as Pipe Studio). |
| `eventpipe create` | Create a webhook endpoint (interactive / flags per CLI help). |

Prefer **`listen` + `--forward-to`** to debug **local** handlers without exposing localhost to the provider.

## HTTP API (fallback if MCP is not available)

Authenticated with **`x-api-key`** or **`Authorization: Bearer <api key>`**. Base URL: app origin (default `https://eventpipe.app`).

| Need | Method | Path |
|------|--------|------|
| Run live version with a synthetic payload | `POST` | `/api/account/pipelines/{pipelineId}/execute` |
| Read pipeline + versions | `GET` | `/api/account/pipelines/{pipelineId}` |
| List pipelines for an endpoint | `GET` | `/api/account/pipelines?endpointId={webhookEndpointId}` |

## Agent checklist

1. Confirm whether the issue is **capture** (endpoint id), **pipeline code** (pipeline id + publish), or **local replay** (forward-to).
2. For local replay: suggest `eventpipe listen <webhookId> --forward-to <url>` and ensure `login` was run.
3. For isolated runs: use `execute_pipeline` tool (or `POST .../execute`) with a minimal JSON body matching the provider shape.
4. Never confuse **webhook id** and **pipeline id** when reading `eventpipe.json` or API paths.
