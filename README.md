# Event Pipe CLI

Official command-line tool for **[Event Pipe](https://eventpipe.app)** — bundle code nodes with [esbuild](https://esbuild.github.io/), **publish new pipeline versions**, create webhook endpoints, stream captured traffic, and keep your handler in sync with Git.

**Website:** [eventpipe.app](https://eventpipe.app) · **npm:** [`@eventpipe/cli`](https://www.npmjs.com/package/@eventpipe/cli)

---

## What you can do

| Area | What the CLI does |
|------|-------------------|
| **Account** | Sign in with the browser (`login`) — same account as the web app; credentials are stored locally for later commands. |
| **Webhooks** | Create endpoints (`create`), listen to the relay in real time (`listen`), optionally **replay** requests to a local URL (`--forward-to`). **`listen` without login** uses a **guest demo** (capped events/time); **with login** and no id, the CLI **prompts** for a label and optional forward URL. |
| **Bundles** | Compile TypeScript handlers to `.eventpipe/` (`build`) with size and sha256 output. |
| **Deploy** | Publish a **new pipeline version** (`push`) using your saved session after `login` — same server route as Pipe Studio. |
| **Tooling** | Print version (`--version`), upgrade the CLI (`update`), optional npm “newer version” hints on stderr, and **`install-cursor-skill`** to copy the bundled **Cursor** agent skill (`eventpipe-debug`). |

---

## Requirements

- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- An Event Pipe account ([eventpipe.app](https://eventpipe.app)) for **`create`**, **`push`**, and **full** **`listen`** (owned endpoints)
- For **`push` / `build`**: an **`eventpipe.json`** at the project root with **`pipelineId`** and **`settings.pipe`** (v3)
- For **guest `listen`** (no account): nothing else — uses **`EVENTPIPE_BASE_URL`** (default **`https://eventpipe.app`**) to reach the app’s guest listen API

---

## Installation

### Global (recommended)

```bash
npm install -g @eventpipe/cli
```

Provides the commands **`eventpipe`** and **`eventpipe-cli`** on your `PATH`.

### As a dev dependency

```bash
npm add -D @eventpipe/cli
# or: pnpm add -D @eventpipe/cli
```

Use **`npx eventpipe …`** or npm scripts.

### Helper scripts (clone of this repo)

Checks Node 20+ and runs a global install:

| OS | Command |
|----|---------|
| **macOS / Linux** | `bash install/macos.sh` |
| **Windows** | `Set-ExecutionPolicy -Scope Process Bypass; .\install\windows.ps1` |

### From source

```bash
git clone <repo-url> && cd eventpipe-cli
pnpm install && pnpm run build
node dist/cli.js --help
```

---

## Quick start

**With an account** (stable endpoint):

```bash
npm install -g @eventpipe/cli
eventpipe login
eventpipe create --name my-endpoint
eventpipe listen <webhookId>
```

**Try `listen` without logging in** (demo: limited events and time; the CLI prints the webhook URL):

```bash
eventpipe listen
# or: eventpipe listen my-demo-id
```

**Logged in, no webhook id yet** — the CLI asks for an **endpoint name** (suggested placeholder like `monkey-ninja-a3f9b`) and whether to **forward** to a local URL; it creates the endpoint then streams.

In a folder with **`eventpipe.json`** and **`src/handler.ts`**:

```bash
eventpipe login
eventpipe build
eventpipe push
```

Default app URL for **`login`** is **`https://eventpipe.app`**. For a self-hosted deployment, set **`EVENTPIPE_BASE_URL`** to your app origin (no trailing slash) **before** `login`.

---

## Commands (reference)

### `eventpipe login`

- Opens the **browser** to sign in with your Event Pipe account.
- Saves session data to **`~/.eventpipe/credentials.json`** (Unix) or your user profile on Windows.
- Clears **`~/.eventpipe/guest-listen.json`** if present (guest demo session file).
- **Required** before **`create`**, **`listen`** on **your** endpoints (by id), and **`push`** (unless you already logged in earlier on this machine). Guest **`listen`** does not require login.
- **`EVENTPIPE_BASE_URL`**: optional; defaults to **`https://eventpipe.app`**. Use your own origin for self-hosted apps.

### `eventpipe create [--name <slug>]`

- Creates a **new webhook endpoint** under your account.
- **`--name`**: requests a URL slug; if it is taken, the CLI may create the endpoint with a random id and warn you.
- Without **`--name`**, the URL and label are generated.
- Output includes the **webhook URL** and id — use the id with **`listen`**.

### `eventpipe listen [webhookId] [options]`

Streams **captured** webhooks for an endpoint through Event Pipe’s relay. Behavior depends on **login** and whether you pass **`webhookId`**:

| Situation | What happens |
|-----------|----------------|
| **Logged in** + **`webhookId`** | Opens a relay stream for **your** endpoint (same as before). |
| **Logged in** + **no `webhookId`** | **Interactive** (TTY only): prompts for an **endpoint name** (default is a random fun placeholder, e.g. `cosmic-otter-glitch-7a2b1`), then **Forward webhooks to a local URL?** — if yes, prompts for URL (default `http://127.0.0.1:3000/api/webhooks`). Creates the endpoint via the API, then listens. If you already passed **`--forward-to`**, the forward question is skipped. |
| **Not logged in** + **no `webhookId`** | **Guest demo**: allocates a temporary guest endpoint on the server, saves **`~/.eventpipe/guest-listen.json`** (session + secret, chmod **600**), streams until **limits** are hit (see below). |
| **Not logged in** + **`webhookId`** | Guest listen for that id (first run creates it; reuse needs the saved guest file). |

**Guest demo limits** (server + CLI): about **25 events** and **15 minutes** per run; the CLI nudges **`eventpipe login`** for unlimited listening and stable endpoints. Endpoints created only in the **browser** as a guest (no CLI secret) cannot be used for guest CLI listen on that id — pick another id or sign in.

**Non-interactive:** if you are **logged in** and omit **`webhookId`** without a TTY, the CLI errors; pass an explicit id or use **`eventpipe create`** first.

| Option | Short | Description |
|--------|-------|-------------|
| `--verbose` | `-v` | After the summary line, print the **full event** JSON (method, headers, query, body). |
| `--json` | | One **JSON object per line** on stdout (NDJSON) — easy to pipe to **`jq`** or scripts. |
| `--forward-to <url>` | | **HTTP replay**: send each event to your URL (e.g. local server). Status lines go to **stderr** so **`--json`** stays clean on stdout. When logged in without **`webhookId`**, sets forwarding and **skips** the forward prompt. |

Examples:

```bash
eventpipe listen
eventpipe listen abc123
eventpipe listen abc123 -v
eventpipe listen abc123 --json | jq .
eventpipe listen abc123 --forward-to http://127.0.0.1:3000/webhook
eventpipe listen --forward-to http://127.0.0.1:3000/api/webhooks
```

The hosted product must have a compatible **relay** and (for guest listen) the **guest listen token** API enabled (see server deployment docs).

### `eventpipe build [--dir <path>]`

- Reads **`eventpipe.json`** (from **`--dir`** or current directory).
- Bundles each configured code entry with **esbuild** into **`.eventpipe/`**.
- Prints **byte size**, **sha256**, and output paths.
- **Limit:** each bundle must be ≤ **200KB** UTF-8 (same as production).

### `eventpipe push [--dir <path>]`

- Runs **`build`**, then **publishes a new pipeline version** via **`POST /api/account/pipelines/{pipelineId}/versions`** with **`codeBundles`** and **`settings`**.
- **Authentication:** only your **saved session** from **`eventpipe login`** (Bearer token + refresh). There is no separate env-based auth path in the CLI.
- **`--pipeline <uuid>`** or **`--flow <uuid>`**: override **`pipelineId`** from **`eventpipe.json`** for this run only.

### `eventpipe mcp setup [--dir <path>] [--client …] [--all-clients]`

**One-command** MCP integration. Run once after **`login`**. **By default** it configures **all** supported clients (Cursor, Claude Code, Claude Desktop). Use **`--client cursor`** if you only want Cursor (no `.mcp.json`, no `CLAUDE.md`, no Desktop app config). **`--all-clients`** is equivalent to the default and remains for scripts or clarity.

```bash
eventpipe mcp setup
eventpipe mcp setup --client cursor
eventpipe mcp setup --client claude-code
```

What it does automatically:

1. Ensures you are logged in (triggers **`login`** if needed).
2. Creates an **API key** (`evp_…`) via **`POST /api/account/api-keys`** — no manual copy-paste (labeled **eventpipe MCP (auto)** in the dashboard).
3. Saves the key to **`~/.eventpipe/mcp.json`** (chmod 600, outside any repo).
4. For each selected **client**, merges the same MCP server entry (`eventpipe` → `eventpipe mcp-serve`):

| Client | Config file |
|--------|-------------|
| **`cursor`** | **`<project>/.cursor/mcp.json`** — also installs the **Cursor skill** (`eventpipe-debug`) if missing. |
| **`claude-code`** | **`<project>/.mcp.json`** — project-scoped MCP for [Claude Code](https://docs.claude.com/en/docs/claude-code/settings) and similar tools; adds/updates a **CLAUDE.md** section with tool names and workflows. |
| **`claude-desktop`** | **Claude Desktop** app config (e.g. macOS: **`~/Library/Application Support/Claude/claude_desktop_config.json`**; Windows: **`%APPDATA%\Claude\claude_desktop_config.json`**; Linux: **`~/.config/Claude/claude_desktop_config.json`**). |

**Requirements:** **`eventpipe`** must be on your **`PATH`** so the client can spawn **`eventpipe mcp-serve`** (same as Cursor).

| Option | Description |
|--------|-------------|
| `--dir` / `-C` | Project directory for project-scoped files (default: cwd). |
| `--client <id>` | One of **`cursor`**, **`claude-code`**, **`claude-desktop`**. Repeatable; if omitted, **all three** are configured. |
| `--all-clients` | Same as default (all three); kept for explicit use in scripts. |

After setup, **restart** the relevant app (Cursor, Claude Desktop) or reload the project (Claude Code). Ask the agent: *"list my pipelines"*.

### `eventpipe mcp serve`

Starts the **MCP server** (stdio). You normally do not run this manually — the **MCP client** spawns it after **`mcp setup`**.

**Tools** exposed to agents:

| Tool | What it does |
|------|-------------|
| `list_endpoints` | List webhook endpoints for your account. |
| `list_pipelines` | List pipelines for a given endpoint. |
| `get_pipeline` | Pipeline details + versions + `settings.pipe`. |
| `execute_pipeline` | Run the live version with a test payload (no publish). |
| `list_executions` | Recent executions for a pipeline (status, duration, errors). |
| `get_execution` | Full execution details with logs, output, and error. |
| `get_request_executions` | All executions triggered by a specific webhook request. |

**Resources:** `eventpipe://guide/debug-local` (listen + forward-to workflow), `eventpipe://guide/ids` (webhook id vs pipeline id reference).

### `eventpipe install-cursor-skill [options]`

Installs the bundled **Cursor** skill **`eventpipe-debug`** (CLI + API + MCP-oriented workflows) so agents know how to use **`listen`**, **`--forward-to`**, **`execute`**, and related tooling. **Note:** **`mcp setup`** already includes this step.

| Option | Description |
|--------|-------------|
| *(default)* | Copy to **`<cwd>/.cursor/skills/eventpipe-debug`** (commit this path to share with your team). |
| `--global` / `-g` | Copy to **`~/.cursor/skills/eventpipe-debug`** (all projects on this machine). |
| `--force` / `-f` | Overwrite if the folder already exists. |
| `--dir` / `-C` | Base directory for project install (default: current working directory). |

```bash
eventpipe install-cursor-skill
eventpipe install-cursor-skill --global
```

### `eventpipe update`

Runs **`npm install -g @eventpipe/cli@latest`** (uses **`npm`** / **`npm.cmd`** on Windows).

### `eventpipe --version` / `eventpipe -v`

Prints the installed **package version**.

### `eventpipe help` / `eventpipe --help`

Prints built-in usage.

---

## Publishing pipeline versions (`build` + `push`) — walkthrough

Publishing creates an **immutable version** of your pipeline; production uses the **current live** version when the pipeline is enabled.

1. **Create the pipeline** in **Pipe Studio**. In the **Event** tab, open **IDs for CLI & API**: copy **Pipeline id** into **`eventpipe.json`** as **`pipelineId`**. That value is **not** the same as the **Webhook endpoint id** (used in `/webhook/…` and for **`listen`**).
2. Ensure **`settings.pipe`** matches your graph — for one code node, the code node **`id`** in the graph must match what you bundle (see **Code** tab for **Code node ids**). Default entry file: **`src/handler.ts`**.
3. **`eventpipe login`** once on the machine.
4. **`eventpipe push`** from the project root (or **`--dir`**).

**Minimal `eventpipe.json` (single code node):**

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

**Minimal `src/handler.ts`:**

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

In production, secrets are read from **`context.env`**, configured in the app **Event** tab — not from **`process.env`** inside the bundle.

**Multi-file / multi-node:** use a **`codeNodes`** map in **`eventpipe.json`** (entry path → node id) when your pipe has more than one code node. See **`examples/stripe-webhook`**.

---

## Project layout

| Path | Purpose |
|------|---------|
| **`eventpipe.json`** | **`pipelineId`**; **`settings`** with **`pipe`** (v3); optional **`nodeId`**, **`entry`**, or **`codeNodes`**. |
| **`src/handler.ts`** | Default entry if **`entry`** is omitted — **`export async function handler(event, context)`**. |
| **`.eventpipe/`** | Generated bundles (from **`build`** / **`push`**). |

## Local CLI files (`~/.eventpipe/`)

| File | Purpose |
|------|---------|
| **`credentials.json`** | Session from **`eventpipe login`** (access + refresh tokens, base URL). |
| **`guest-listen.json`** | Guest **`listen`** session (`webhookId`, `guestCliToken`, `baseUrl`) for reconnecting without login. Removed when the guest session ends (limits) or after **`eventpipe login`**. |
| **`mcp.json`** | API key for **`eventpipe mcp serve`** (from **`mcp setup`**). |

---

## Update hints

After most commands, the CLI may query npm for a newer **`@eventpipe/cli`** and print a short message on **stderr** suggesting **`eventpipe update`**. Set **`EVENTPIPE_SKIP_UPDATE_CHECK=1`** to disable (e.g. in automation logs).

---

## Examples in this repo

- **`examples/stripe-webhook`** — multi-node **`codeNodes`**, Stripe over **`fetch`** to stay under the bundle cap.

---

## Limits

- **Guest `listen`**: capped demo (event + time limits); sign in for unlimited streaming on owned endpoints.
- **~200KB** per code-node bundle (UTF-8), enforced locally and on the server.
- This CLI’s ergonomics focus on **single-code-node** or explicitly mapped **`codeNodes`**; very large graphs can also be published from the **[dashboard](https://eventpipe.app)**.

---

## Getting help

- **Product & guides:** [eventpipe.app](https://eventpipe.app) — Documentation (Inspector, Pipe Studio, CLI, API).
- **CLI:** `eventpipe help`
- **Issues:** your package or source repository’s issue tracker.
