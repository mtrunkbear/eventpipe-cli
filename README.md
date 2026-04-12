# @eventpipe/cli

Build **Event Pipe** code-node bundles with [esbuild](https://esbuild.github.io/) and publish them with an **account API key** (`x-api-key`), same auth as the dashboard.

## Install

```bash
pnpm add -D @eventpipe/cli
# or: npm i -D @eventpipe/cli
```

From a git checkout:

```bash
cd eventpipe-cli && pnpm install && pnpm run build
# binary: ./dist/cli.js
```

## Project layout

| File | Purpose |
|------|---------|
| `eventpipe.json` | `flowId`, optional `nodeId` / `entry`, and `settings` (must include `pipe` v3) |
| `src/handler.ts` | Default entry — `export async function handler(event, context)` |

Runtime uses **`context.env`** for secrets (configure values in the app **Event** tab), not `process.env`.

## Commands

- **`build`** — Writes `.eventpipe/bundle.js` and prints size + sha256 (must be ≤ 200KB).
- **`push`** — Runs `build`, then `POST /api/account/pipelines/:flowId/versions` with `codeBundles`.

Environment for `push`:

- `EVENTPIPE_BASE_URL` — Origin of your Next app (no trailing slash).
- `EVENTPIPE_API_KEY` — Plaintext key from account API keys (`evp_...`).

Optional: `--flow <uuid>` overrides `flowId` in `eventpipe.json`.

## Example

See `examples/stripe-webhook` (Stripe Balance via REST to stay under the bundle size cap).

## Limits

- One **code node** per project in this CLI version (multi-node flows: publish from the dashboard or extend the CLI).
- Per-node bundle max **200KB** UTF-8 (same as the server).
