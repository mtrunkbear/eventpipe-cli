# Stripe balance (REST) — Event Pipe example

This folder is a minimal **eventpipe** project: one code node that calls Stripe’s HTTP API with `context.env.STRIPE_SECRET_KEY`. Values are configured in the dashboard **Event** tab (`settings.env`), not in git.

## Why not `import "stripe"`?

The official `stripe` npm package bundles to **>200KB**, which exceeds the per-code-node limit enforced by the platform. This example uses `fetch` to `https://api.stripe.com/v1/balance` instead.

## Setup

1. Create a pipeline in the dashboard and copy its **pipeline ID** into `eventpipe.json` (`pipelineId`).
2. Create an **API key** under account settings (used as `EVENTPIPE_API_KEY`).
3. In the flow **Event** tab, set `STRIPE_SECRET_KEY` to your `sk_test_...` or `sk_live_...` secret.

## Commands

From the **`eventpipe-cli` repo root**:

```bash
pnpm install
pnpm run build
cd examples/stripe-webhook
pnpm run build
```

Publish a new version (requires env):

```bash
export EVENTPIPE_BASE_URL=https://your-app.example.com
export EVENTPIPE_API_KEY=evp_...
pnpm run push
```

Override flow id without editing the file:

```bash
node ../../dist/cli.js push --dir . --flow "<uuid>"
```

## Contract

`eventpipe.json` declares `envContract` for `STRIPE_SECRET_KEY` so the studio can show hints; runtime reads **`context.env.STRIPE_SECRET_KEY`** only.
