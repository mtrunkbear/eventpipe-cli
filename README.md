# @eventpipe/cli

Build **Event Pipe** code-node bundles with [esbuild](https://esbuild.github.io/), publish with an **API key**, and use **login / create / listen** against the dashboard (Supabase session + relay WebSocket).

## Install

```bash
pnpm add -D @eventpipe/cli
# or: npm i -D @eventpipe/cli
```

Global install (provides `eventpipe` and `eventpipe-cli`):

```bash
npm install -g @eventpipe/cli
```

From a git checkout:

```bash
cd eventpipe-cli && pnpm install && pnpm run build
# binaries: ./dist/cli.js
```

## Project layout

| File | Purpose |
|------|---------|
| `eventpipe.json` | `pipelineId`, optional `nodeId` / `entry`, and `settings` (must include `pipe` v3) |
| `src/handler.ts` | Default entry — `export async function handler(event, context)` |

Runtime uses **`context.env`** for secrets (configure values in the app **Event** tab), not `process.env`.

## Commands

### Auth & endpoints

- **`login`** — Opens the browser to complete Supabase login; saves `~/.eventpipe/credentials.json`. Requires `EVENTPIPE_BASE_URL`.
- **`create [--name <slug>]`** — `POST /api/account/endpoints` (session auth). `--name` sets the URL slug (`/api/webhook/your-slug`) if it’s free; otherwise a random id is used. With no `--name`, the URL and display label are random.
- **`listen <webhookId> [options]`** — Connects to the relay; prints one line per webhook. **`--verbose` / `-v`** prints the full event JSON (method, headers, query, body). **`--json`** prints one JSON object per line (stdout) for scripts. **`--forward-to http://127.0.0.1:PORT/path`** replays each request to your local server (forward status on stderr).

### Bundles

- **`build`** — Writes `.eventpipe/*.bundle.js` and prints size + sha256 (must be ≤ 200KB).
- **`push`** — Runs `build`, then `POST /api/account/pipelines/:pipelineId/versions` with `codeBundles`.

### Environment

| Variable | Used by | Description |
|----------|---------|-------------|
| `EVENTPIPE_BASE_URL` | login, create, listen, push | Origin of the Next app (no trailing slash) |
| `EVENTPIPE_API_KEY` | push | Plaintext key from account API keys (`evp_...`) |

Optional: `--pipeline <uuid>` (or `--flow`) overrides `pipelineId` in `eventpipe.json` for `push`.

### Server requirements for `listen`

The app needs a deployed **eventpipe-relay** (or compatible) service plus env vars documented in the app `.env.example`: `EVENTPIPE_RELAY_URL`, `EVENTPIPE_RELAY_WS_URL`, `EVENTPIPE_RELAY_INGEST_SECRET`, `EVENTPIPE_LISTEN_JWT_SECRET` (shared with the relay).

## Example

See `examples/stripe-webhook` (Stripe Balance via REST to stay under the bundle size cap).

## Limits

- One **code node** per project in this CLI version (multi-node flows: publish from the dashboard or extend the CLI).
- Per-node bundle max **200KB** UTF-8 (same as the server).
