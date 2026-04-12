# Event Pipe CLI

Official command-line tool for **[Event Pipe](https://eventpipe.app)** — build code-node bundles, publish new versions of your flows, and manage webhooks from the terminal.

**Website:** [eventpipe.app](https://eventpipe.app)

Use this CLI when you want to work locally with TypeScript, automate publishes with an API key, stream incoming webhooks to your machine, or forward them to a dev server.

---

## What you can do

| Area | What the CLI does |
|------|-------------------|
| **Account** | Sign in with your browser (`login`) — same account as on the web app. |
| **Webhooks** | Create new webhook endpoints (`create`) and stream events in real time (`listen`). |
| **Code & deploy** | Bundle your handler with esbuild (`build`) and upload a new pipeline version (`push`) using your **login** or an **API key** in CI. |
| **Tooling** | Check the installed version, update from npm, and opt out of update hints in CI. |

---

## Requirements

- **Node.js 20 or newer** ([nodejs.org](https://nodejs.org))
- An Event Pipe account (sign up at [eventpipe.app](https://eventpipe.app))

---

## Installation

### Global (recommended)

Installs the `eventpipe` and `eventpipe-cli` commands on your PATH:

```bash
npm install -g @eventpipe/cli
```

### Per project (dev dependency)

```bash
npm add -D @eventpipe/cli
# or: pnpm add -D @eventpipe/cli
```

Run with `npx eventpipe …` or add an npm script.

### Install scripts (from a clone of this repo)

If you cloned the repository, you can use the helper scripts (they check Node 20+ and run a global install):

**macOS / Linux**

```bash
bash install/macos.sh
```

**Windows (PowerShell)**

```powershell
Set-ExecutionPolicy -Scope Process Bypass; .\install\windows.ps1
```

### Develop from source

```bash
git clone <repo-url> && cd eventpipe-cli
pnpm install && pnpm run build
node dist/cli.js --help
```

---

## Quick start

1. **Sign in** (opens the browser; credentials are saved under your home directory):

   ```bash
   eventpipe login
   ```

   By default this uses **[https://eventpipe.app](https://eventpipe.app)**. Set `EVENTPIPE_BASE_URL` only if you use a self-hosted app.

2. **Create a webhook endpoint** (optional slug for a readable URL):

   ```bash
   eventpipe create --name my-endpoint
   ```

   Note the **webhook id** from the output or from the [dashboard](https://eventpipe.app).

3. **Listen for events** (replace with your webhook id):

   ```bash
   eventpipe listen <webhookId>
   ```

4. **In a project with `eventpipe.json`**, build and publish (uses the same login as step 1):

   ```bash
   eventpipe build
   eventpipe push
   ```

   In **CI or automation**, set an API key instead of interactive login: `export EVENTPIPE_API_KEY=evp_…` (from **Account → API keys** in the app). If both login and `EVENTPIPE_API_KEY` exist, the key wins.

---

## Commands

### `eventpipe login`

Opens your browser to complete sign-in (session stored for the CLI). Credentials are written to **`~/.eventpipe/credentials.json`** (Unix) or the equivalent under your user profile on Windows.

- **Default app URL:** `https://eventpipe.app`
- **Override:** set `EVENTPIPE_BASE_URL` to your own deployment origin (no trailing slash), e.g. `https://app.example.com`.

---

### `eventpipe create [--name <slug>]`

Creates a new webhook endpoint using your logged-in session.

| Option | Meaning |
|--------|---------|
| `--name <slug>` | If the slug is free, your webhook URL can use that path; if it is taken, the CLI creates the endpoint with a random id and may warn you. |
| *(none)* | URL and label are generated for you. |

You’ll see the public webhook URL in the output. Manage endpoints in the [web app](https://eventpipe.app).

---

### `eventpipe listen <webhookId> [options]`

Connects to Event Pipe’s relay and prints **one line per incoming webhook** on stdout. Use this to debug integrations or pipe events into scripts.

| Option | Short | Description |
|--------|-------|-------------|
| `--verbose` | `-v` | Print the full event payload (method, headers, query, body) as formatted JSON after the summary line. |
| `--json` | | Print **one JSON object per line** (NDJSON) on stdout — good for tooling and `jq`. |
| `--forward-to <url>` | | Replay each event as an HTTP request to your URL (e.g. local server). Forward result messages go to **stderr** so stdout stays clean for `--json`. |

**Examples**

```bash
eventpipe listen abc123
eventpipe listen abc123 -v
eventpipe listen abc123 --json | jq .
eventpipe listen abc123 --forward-to http://127.0.0.1:3000/webhook
```

**Requirements:** you must have run **`eventpipe login`** first. The hosted app must be configured with a compatible relay service (see your deployment docs / `.env.example` for relay-related variables).

---

### `eventpipe build [--dir <path>]`

Reads **`eventpipe.json`** in the project (or `--dir`), bundles your code nodes with [esbuild](https://esbuild.github.io/), and writes artifacts under **`.eventpipe/`** (sizes and hashes are printed). Each bundle must stay within the **200KB** limit (same as the server).

---

### `eventpipe push [--dir <path>]`

Runs **`build`**, then uploads a **new version** of your pipeline. Authentication:

| Mode | When |
|------|------|
| **Session (default)** | After **`eventpipe login`**. The CLI sends your Supabase access token as `Authorization: Bearer …`, same as the dashboard. |
| **API key** | Set **`EVENTPIPE_API_KEY`** (e.g. in CI). If the variable is set, it is used **instead of** the saved login. |

| Need | Detail |
|------|--------|
| `EVENTPIPE_BASE_URL` | Only for **API key** pushes when not using default app; defaults to `https://eventpipe.app`. Session pushes use the URL stored at login. |
| `--pipeline <uuid>` or `--flow <uuid>` | Optional; overrides `pipelineId` in `eventpipe.json` for this push only. |

Examples:

```bash
eventpipe push --dir ./my-flow
```

```bash
export EVENTPIPE_API_KEY=evp_xxxxxxxx
eventpipe push --dir ./my-flow
```

---

### `eventpipe update`

Runs **`npm install -g @eventpipe/cli@latest`** so you get the newest published CLI (uses `npm` on your PATH; on Windows the CLI invokes `npm.cmd` as needed).

---

### `eventpipe --version` / `eventpipe -v`

Prints the installed package version.

---

### `eventpipe help` / `eventpipe --help`

Prints built-in usage.

---

## Project layout (for `build` / `push`)

| File / folder | Role |
|---------------|------|
| **`eventpipe.json`** | **`pipelineId`**, flow **`settings`** (must include `pipe` v3), and optional **`nodeId`**, **`entry`**, or **`codeNodes`** map. |
| **`src/handler.ts`** | Default entry if you don’t set `entry` — export `handler(event, context)`. |
| **`.eventpipe/`** | Generated bundles (created by `build` / `push`). |

**Secrets at runtime:** in the cloud, your flow uses **`context.env`** for configured secrets (set in the app’s **Event** / pipeline UI), not `process.env` in the bundle.

---

## Environment variables

| Variable | When it matters | Description |
|----------|-----------------|-------------|
| **`EVENTPIPE_BASE_URL`** | `login`, `push` (with API key) | App origin, no trailing slash. **Default:** `https://eventpipe.app`. Session-based `push` uses the URL from `login`. |
| **`EVENTPIPE_API_KEY`** | `push` (optional) | Account API key (`evp_…`). Use in CI or to override the saved session. |
| **`EVENTPIPE_SKIP_UPDATE_CHECK`** | any | Set to `1` to disable the occasional **“newer version on npm”** message on stderr (useful in CI). |

---

## Update hints

After most commands, the CLI may check npm for a **newer `@eventpipe/cli`** and print a short message on **stderr** suggesting:

```bash
eventpipe update
```

To turn this off, set `EVENTPIPE_SKIP_UPDATE_CHECK=1`.

---

## Example project

See **`examples/stripe-webhook`** in this repository for a sample layout and Stripe-oriented flow.

---

## Limits (current CLI)

- **Single-code-node focus:** one primary code-node workflow per project is the happy path; multi-node flows may need publishing from the **[dashboard](https://eventpipe.app)** or extending the CLI.
- **Bundle size:** **200KB** UTF-8 per code-node bundle (enforced locally and on the server).

---

## Getting help

- **Product & docs:** [eventpipe.app](https://eventpipe.app)
- **CLI usage:** `eventpipe help`
- **Issues:** use your repository’s issue tracker if you develop the CLI from source.
