# Event Pipe CLI

Official command-line tool for **[Event Pipe](https://eventpipe.app)** — bundle code nodes with [esbuild](https://esbuild.github.io/), **publish new pipeline versions**, create webhook endpoints, and stream events to your machine.

**Website:** [eventpipe.app](https://eventpipe.app) · **npm:** [`@eventpipe/cli`](https://www.npmjs.com/package/@eventpipe/cli)

---

## What you can do

| Area | What the CLI does |
|------|-------------------|
| **Publish** | Run **`eventpipe push`** after **`eventpipe login`** to upload a new pipeline version (same API as Pipe Studio). |
| **CI** | Set **`EVENTPIPE_API_KEY`** so **`push`** works without a browser. |
| **Webhooks** | **`create`** endpoints and **`listen`** to the relay (with optional **`--forward-to`** for local replay). |
| **Tooling** | **`eventpipe update`**, **`--version`**, and optional npm version hints on stderr. |

---

## Requirements

- **Node.js 20 or newer** ([nodejs.org](https://nodejs.org))
- An Event Pipe account ([sign up](https://eventpipe.app))
- For **`push`**: a **pipeline** already created in the app, and its **`pipelineId`** (UUID) in **`eventpipe.json`**

---

## Installation

### Global (recommended)

```bash
npm install -g @eventpipe/cli
```

This provides **`eventpipe`** and **`eventpipe-cli`** on your `PATH`.

### Per project

```bash
npm add -D @eventpipe/cli
```

Run with **`npx eventpipe …`** or npm scripts.

### Install scripts (from a clone of this repo)

**macOS / Linux:** `bash install/macos.sh`  
**Windows (PowerShell):** `Set-ExecutionPolicy -Scope Process Bypass; .\install\windows.ps1`

### Develop from source

```bash
git clone <repo-url> && cd eventpipe-cli
pnpm install && pnpm run build
node dist/cli.js --help
```

---

## Publishing pipeline versions (`build` + `push`)

Publishing creates a **new immutable version** of your pipeline by calling **`POST /api/account/pipelines/{pipelineId}/versions`** with bundled code — the same endpoint the [web app](https://eventpipe.app) uses.

### 1. Get `pipelineId`

In **Pipe Studio**, open your pipeline and copy its **UUID** from the URL or settings.

### 2. Add `eventpipe.json` (minimal single code node)

The **`code`** node id in **`settings.pipe`** must match the code node you bundle (default file: **`src/handler.ts`**).

```json
{
  "pipelineId": "YOUR_PIPELINE_UUID",
  "settings": {
    "pipe": {
      "schemaVersion": 3,
      "nodes": [
        { "id": "code", "type": "code", "config": {} }
      ],
      "edges": []
    }
  }
}
```

### 3. Handler entry (`src/handler.ts`)

```typescript
type FlowEvent = {
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

type FlowContext = { env?: Record<string, string> };

export async function handler(event: FlowEvent, _context: FlowContext) {
  return { ok: true, received: event.body };
}
```

In production, secrets are read from **`context.env`** (set in the app **Event** tab), not from `process.env` inside the bundle.

### 4. Sign in and push

```bash
eventpipe login
eventpipe push
```

- **`login`** opens the browser and saves session under **`~/.eventpipe/credentials.json`**. Default app is **`https://eventpipe.app`** (override with **`EVENTPIPE_BASE_URL`** for self-hosted).
- **`push`** runs **`build`** then uploads bundles. If **`EVENTPIPE_API_KEY`** is set, it is used **instead of** session (typical for **CI**).

### CI example

```bash
export EVENTPIPE_API_KEY=evp_xxxxxxxx
# optional for self-hosted: export EVENTPIPE_BASE_URL=https://your-app.example.com
eventpipe push --dir ./my-flow
```

### Override pipeline id

```bash
eventpipe push --pipeline <uuid>
# alias: --flow <uuid>
```

---

## Other commands (summary)

| Command | Purpose |
|---------|---------|
| **`eventpipe login`** | Browser sign-in; stores session. |
| **`eventpipe create [--name <slug>]`** | New webhook endpoint (requires login). |
| **`eventpipe listen <id> [--json] [-v] [--forward-to <url>]`** | Stream webhooks from the relay. |
| **`eventpipe build [--dir <path>]`** | Esbuild → `.eventpipe/`; prints size and hash (max **200KB** per bundle). |
| **`eventpipe update`** | Runs **`npm install -g @eventpipe/cli@latest`**. |
| **`eventpipe -v` / `--version`** | Print CLI version. |
| **`eventpipe help`** | Built-in usage. |

---

## Project layout

| File / folder | Role |
|---------------|------|
| **`eventpipe.json`** | **`pipelineId`**, **`settings.pipe`** (v3), optional **`nodeId`**, **`entry`**, or **`codeNodes`** for multi-file graphs. |
| **`src/handler.ts`** | Default entry when **`entry`** is omitted. |
| **`.eventpipe/`** | Generated bundles (from **`build`** / **`push`**). |

---

## Update hints

After most commands, the CLI may check npm for a newer **`@eventpipe/cli`** and print a short message on **stderr** suggesting **`eventpipe update`**. Set **`EVENTPIPE_SKIP_UPDATE_CHECK=1`** to disable (e.g. in CI).

---

## Example

See **`examples/stripe-webhook`** for a fuller project (multi-node **`codeNodes`** example).

---

## Limits

- **Single-code-node** workflows are the simplest; multi-node graphs may need a **`codeNodes`** map or publishing from the [dashboard](https://eventpipe.app).
- **200KB** UTF-8 per code-node bundle (same as the server).

---

## Getting help

- **Product:** [eventpipe.app](https://eventpipe.app) — platform docs include **CLI** and **API reference**.
- **This repo:** `eventpipe help`
