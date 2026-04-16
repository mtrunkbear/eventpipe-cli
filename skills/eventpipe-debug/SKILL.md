---
name: eventpipe-debug
description: Debugs Event Pipe webhooks and pipelines using the official CLI (listen, forward-to, build, push), the dashboard HTTP API (execute, versions), and optional Event Pipe MCP tools. Use when the user works with eventpipe, webhook capture, Pipe Studio, pipelines, handler bundles, or asks to debug or trace webhook traffic locally.
---

# Event Pipe — debug and tooling

## Mental model

- **Webhook endpoint id** (`webhookId`): public capture URL segment; used with `eventpipe listen <webhookId>` and the Inspector.
- **Pipeline id** (`pipelineId`): UUID for Pipe Studio / `eventpipe.json`; **not** the same as `webhookId`. Publishing uses the pipeline id.
- Traffic hits the **cloud** first; `listen` streams events to the CLI via the relay. **`--forward-to`** replays each captured request to a local URL (your dev server).

## CLI (after `eventpipe login`)

| Command | Purpose |
|--------|---------|
| `eventpipe listen <webhookId>` | Stream captured webhooks as JSON (use `--verbose` for full event). |
| `eventpipe listen <webhookId> --forward-to http://127.0.0.1:3000/path` | Same, plus HTTP replay to localhost (forward status on stderr). |
| `eventpipe build` | Bundle TypeScript to `.eventpipe/` (requires `eventpipe.json` with `settings.pipe` v3). |
| `eventpipe push` | Build and publish a new pipeline version (same route as Pipe Studio). |
| `eventpipe create` | Create a webhook endpoint (interactive / flags per CLI help). |

Prefer **`listen` + `--forward-to`** to debug **local** handlers without exposing localhost to Stripe. Use **`build` / `push`** when the handler code or `settings.pipe` changed.

## HTTP API (debug without publishing)

Authenticated with **`x-api-key`** or **`Authorization: Bearer <api key>`** (see app **Documentation → API**). Base URL: app origin (default `https://eventpipe.app`, or `EVENTPIPE_BASE_URL`).

| Need | Method | Path |
|------|--------|------|
| Run **live** current version with a synthetic payload | `POST` | `/api/account/pipelines/{pipelineId}/execute` |
| Read pipeline + **versions** (incl. `settings.pipe`) | `GET` | `/api/account/pipelines/{pipelineId}` |
| List pipelines for an endpoint | `GET` | `/api/account/pipelines?endpointId={webhookEndpointId}` |

Use **execute** to reproduce failures with a controlled body; correlate with **listen** for real provider traffic.

## Optional: Event Pipe MCP

If the user has configured an **Event Pipe MCP** server in Cursor, prefer its tools to **list pipelines**, **get pipeline + versions**, and **execute** — same capabilities as the API with less manual `curl`.

Environment for MCP (typical): `EVENTPIPE_BASE_URL`, `EVENTPIPE_API_KEY`.

Install this skill from the CLI: `eventpipe install-cursor-skill` (project) or `eventpipe install-cursor-skill --global`. See [mcp-setup.md](mcp-setup.md) for an example MCP server entry once `@eventpipe/mcp` (or your server) is available.

## Agent checklist

1. Confirm whether the issue is **capture** (endpoint id), **pipeline code** (pipeline id + publish), or **local replay** (forward-to).
2. For local replay: suggest `eventpipe listen <webhookId> --forward-to <url>` and ensure `login` was run.
3. For isolated runs: suggest `POST .../execute` with a minimal JSON body matching the provider shape.
4. Never confuse **webhook id** and **pipeline id** when reading `eventpipe.json` or API paths.
