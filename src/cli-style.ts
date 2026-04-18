const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const BANNER_LINES = [
  "                       _         _            ",
  "   _____   _____ _ __ | |_ _ __ (_)_ __   ___ ",
  "  / _ \\ \\ / / _ \\ '_ \\| __| '_ \\| | '_ \\ / _ \\",
  " |  __/\\ V /  __/ | | | |_| |_) | | |_) |  __/",
  "  \\___| \\_/ \\___|_| |_|\\__| .__/|_| .__/ \\___|",
  "                          |_|     |_|         ",
] as const;

const CHEVRON_LINES = ["██╗", "██║", "██║", "██║", "██║", "   "] as const;

function useColor(): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "2" || process.env.FORCE_COLOR === "3") {
    return true;
  }
  return Boolean(process.stdout.isTTY);
}

function rgbFg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function gradientRgb(t: number): [number, number, number] {
  const c1: [number, number, number] = [79, 209, 197];
  const c2: [number, number, number] = [72, 188, 210];
  const c3: [number, number, number] = [106, 154, 232];
  if (t <= 0.5) {
    const u = t / 0.5;
    return [lerp(c1[0], c2[0], u), lerp(c1[1], c2[1], u), lerp(c1[2], c2[2], u)];
  }
  const u = (t - 0.5) / 0.5;
  return [lerp(c2[0], c3[0], u), lerp(c2[1], c3[1], u), lerp(c2[2], c3[2], u)];
}

function colorizeAsciiLine(line: string, maxLen: number, color: boolean): string {
  if (!color) {
    return line;
  }
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === " ") {
      out += `${DIM}\x1b[38;2;58;60;72m${ch}${RESET}`;
      continue;
    }
    const t = maxLen > 1 ? i / (maxLen - 1) : 0;
    const [r, g, b] = gradientRgb(t);
    out += `${rgbFg(r, g, b)}${ch}${RESET}`;
  }
  return out;
}

function colorizeChevronLine(line: string, color: boolean): string {
  if (!color) {
    return line;
  }
  const [r, g, b] = [79, 209, 197];
  return `${rgbFg(r, g, b)}${line}${RESET}`;
}

export function printBanner(color: boolean = useColor()): void {
  const maxW = Math.max(...BANNER_LINES.map((l) => l.length));
  for (let row = 0; row < BANNER_LINES.length; row++) {
    const art = BANNER_LINES[row] ?? "";
    const chev = CHEVRON_LINES[row] ?? "   ";
    const chevCol = colorizeChevronLine(chev, color);
    const body = colorizeAsciiLine(art, maxW, color);
    console.log(`${chevCol} ${body}`);
  }
  console.log("");
}

const ACCENT = "\x1b[38;2;79;209;197m";

export function printUsage(version: string, baseUrlHint: string): void {
  const color = useColor();
  printBanner(color);

  const title = color
    ? `${DIM}eventpipe CLI — build, stream, and publish.${RESET}`
    : "eventpipe CLI — build, stream, and publish.";
  console.log(title);
  console.log("");

  console.log(color ? `${DIM}Tips for getting started:${RESET}` : "Tips for getting started:");
  const t1 = color ? `${DIM}1.${RESET} Run ${ACCENT}eventpipe login${RESET} to authenticate in the browser.` : "1. Run eventpipe login to authenticate in the browser.";
  const t2 = color
    ? `${DIM}2.${RESET} Use ${ACCENT}eventpipe listen [webhookId]${RESET} to stream webhooks (no id: guest demo, or prompts when logged in).`
    : "2. Use eventpipe listen [webhookId] to stream webhooks (no id: guest demo, or prompts when logged in).";
  const t3 = color
    ? `${DIM}3.${RESET} ${ACCENT}eventpipe mcp setup${RESET} for Cursor, Claude Code, or Claude Desktop (debug with AI).`
    : "3. eventpipe mcp setup for Cursor, Claude Code, or Claude Desktop (debug with AI).";
  const t4 = color
    ? `${DIM}4.${RESET} ${ACCENT}eventpipe help${RESET} for all commands and flags.`
    : "4. eventpipe help for all commands and flags.";
  console.log(`  ${t1}`);
  console.log(`  ${t2}`);
  console.log(`  ${t3}`);
  console.log(`  ${t4}`);
  console.log("");

  console.log(color ? `${DIM}Environment:${RESET}` : "Environment:");
  console.log(
    color
      ? `  ${DIM}EVENTPIPE_BASE_URL${RESET}   App origin for login (default: https://eventpipe.app); override for self-hosted`
      : "  EVENTPIPE_BASE_URL   App origin for login (default: https://eventpipe.app); override for self-hosted",
  );
  console.log(
    color
      ? `  ${DIM}EVENTPIPE_SKIP_UPDATE_CHECK${RESET}   Set to 1 to disable the npm version hint on stderr`
      : "  EVENTPIPE_SKIP_UPDATE_CHECK   Set to 1 to disable the npm version hint on stderr",
  );
  console.log("");

  console.log(color ? `${DIM}Commands:${RESET}` : "Commands:");
  type CmdRow = { name: string; desc: string[] };
  const cmds: CmdRow[] = [
    { name: "login", desc: ["Browser login (stores ~/.eventpipe/credentials.json)"] },
    { name: "create [--name <s>]", desc: ["Create a webhook endpoint (requires login)"] },
    {
      name: "listen [webhookId] [--verbose|-v] [--json] [--forward-to <url>]",
      desc: [
        "Stream webhooks; no id + no login: auto guest demo; no id + logged in: prompts for name & optional forward;",
        "--verbose prints full JSON event; --json one NDJSON line per event;",
        "--forward-to skips the forward prompt when logged in without webhookId",
      ],
    },
    { name: "build [--dir <path>]", desc: ["Bundle TS into .eventpipe/"] },
    { name: "push [--dir <path>]", desc: ["build + publish (requires eventpipe login)"] },
    { name: "update", desc: ["npm install -g @eventpipe/cli@latest"] },
    {
      name: "mcp setup [--dir <path>] [--client …] [--all-clients]",
      desc: [
        "MCP config: API key → ~/.eventpipe/mcp.json; default = all clients (Cursor,",
        "Claude Code, Claude Desktop). Use --client cursor for Cursor-only.",
      ],
    },
    {
      name: "mcp serve",
      desc: [
        "Start MCP server (stdio). Your editor spawns this after mcp setup.",
      ],
    },
    {
      name: "install-cursor-skill [--global] [--force] [--dir <path>]",
      desc: [
        "Copy bundled Cursor skill (eventpipe-debug) to .cursor/skills or ~/.cursor/skills",
      ],
    },
    { name: "help", desc: [] },
  ];
  const cmdW = Math.max(...cmds.map((c) => c.name.length));
  for (const { name, desc } of cmds) {
    if (desc.length === 0) {
      console.log(color ? `  ${ACCENT}${name}${RESET}` : `  ${name}`);
      continue;
    }
    const pad = " ".repeat(Math.max(1, cmdW - name.length + 2));
    const [first, ...rest] = desc;
    console.log(
      color
        ? `  ${ACCENT}${name}${RESET}${pad}${DIM}${first}${RESET}`
        : `  ${name}${pad}${first}`,
    );
    const indent = " ".repeat(cmdW + 4);
    for (const line of rest) {
      console.log(color ? `${indent}${DIM}${line}${RESET}` : `${indent}${line}`);
    }
  }
  console.log("");

  const manifestNote = color
    ? `${DIM}eventpipe.json must define pipelineId and settings.pipe (v3) for build/push.${RESET}`
    : "eventpipe.json must define pipelineId and settings.pipe (v3) for build/push.";
  console.log(manifestNote);
  console.log("");

  const status = color
    ? `${DIM}Using: @eventpipe/cli ${version} | ${baseUrlHint}${RESET}`
    : `Using: @eventpipe/cli ${version} | ${baseUrlHint}`;
  console.log(status);
}

export function defaultBaseUrlHint(): string {
  const u = process.env.EVENTPIPE_BASE_URL?.trim();
  if (u) {
    return `base URL ${u}`;
  }
  return "base URL https://eventpipe.app (default)";
}

export function printGuestListenIntro(
  webhookUrl: string,
  maxEvents: number,
  sessionMinutes: number,
  color: boolean = useColor(),
): void {
  const warn = color ? "\x1b[38;2;234;179;8m" : "";
  const reset = color ? RESET : "";
  const dim = color ? DIM : "";
  const accent = color ? ACCENT : "";
  console.log(
    color
      ? `${warn}!${reset}  ${dim}Guest mode${reset} — ${maxEvents} events · ${sessionMinutes} min · endpoint is not tied to an account`
      : `!  Guest mode — ${maxEvents} events · ${sessionMinutes} min · endpoint is not tied to an account`,
  );
  console.log("");
  console.log(color ? `   ${dim}Webhook URL:${reset}` : "   Webhook URL:");
  console.log(color ? `   ${accent}${webhookUrl}${reset}` : `   ${webhookUrl}`);
  console.log("");
  console.log(
    color
      ? `   Run ${accent}eventpipe login${reset} ${dim}for a stable endpoint and unlimited listening.${reset}`
      : `   Run eventpipe login for a stable endpoint and unlimited listening.`,
  );
  console.log("");
}

export function printGuestListenMilestone(current: number, max: number, color: boolean = useColor()): void {
  const dim = color ? DIM : "";
  const accent = color ? ACCENT : "";
  const reset = color ? RESET : "";
  const suffix =
    current >= max - 1
      ? color
        ? ` ${dim}[${current}/${max} — ${accent}eventpipe login${reset}${dim} removes this cap]${reset}`
        : ` [${current}/${max} — eventpipe login removes this cap]`
      : color
        ? ` ${dim}[${current}/${max}]${reset}`
        : ` [${current}/${max}]`;
  process.stderr.write(`${suffix}\n`);
}

type FlowEventWirePartial = {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  path?: string;
  receivedAt?: number;
};

function methodColor(method: string, color: boolean): string {
  if (!color) {
    return method.toUpperCase().padEnd(7);
  }
  const m = method.toUpperCase();
  const padded = m.padEnd(7);
  const c: Record<string, string> = {
    GET: rgbFg(99, 202, 183),
    POST: rgbFg(134, 239, 172),
    PUT: rgbFg(253, 224, 71),
    PATCH: rgbFg(253, 224, 71),
    DELETE: rgbFg(248, 113, 113),
    HEAD: rgbFg(167, 139, 250),
    OPTIONS: rgbFg(167, 139, 250),
  };
  return `${c[m] ?? rgbFg(200, 200, 200)}${BOLD}${padded}${RESET}`;
}

function resolveOrigin(headers: Record<string, string>): string {
  const raw =
    headers["origin"] ??
    headers["referer"] ??
    headers["x-forwarded-for"] ??
    headers["x-real-ip"] ??
    "";
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.split(",")[0]?.trim().split("/")[0]?.trim() ?? raw;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\u2026` : s;
}

function formatQuery(query: Record<string, string>): string {
  const pairs = Object.entries(query)
    .map(([k, v]) => `${k}=${v}`)
    .join("  ");
  return truncate(pairs, 80);
}

function formatBody(body: unknown): string {
  if (body === null || body === undefined) {
    return "";
  }
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return truncate(raw, 120);
}

function formatKbFromBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatTime(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toTimeString().slice(0, 8);
}

export function printWebhookEvent(params: {
  bytes: number;
  event: FlowEventWirePartial;
  color?: boolean;
}): void {
  const color = params.color ?? useColor();
  const { bytes, event } = params;

  const method = (event.method ?? "POST").toUpperCase();
  const headers = event.headers ?? {};
  const query = event.query ?? {};
  const body = event.body;
  const origin = resolveOrigin(headers);
  const time = formatTime(event.receivedAt);
  const size = formatKbFromBytes(bytes);

  const dim = color ? DIM : "";
  const reset = color ? RESET : "";
  const accent = color ? ACCENT : "";

  const labelW = 8;
  const label = (s: string) =>
    color ? `  ${dim}${s.padEnd(labelW)}${reset}` : `  ${s.padEnd(labelW)}`;

  const methodStr = methodColor(method, color);
  const originStr = origin ? (color ? `${dim}${origin}${reset}` : origin) : "";
  const timeStr = color ? `${dim}${time}${reset}` : time;
  const sizeStr = color ? `${dim}${size}${reset}` : size;

  const headerParts = [methodStr, originStr, sizeStr, timeStr].filter(Boolean);
  console.log(`\u{1F4E9} ${headerParts.join(color ? `  ${dim}\u00B7${reset}  ` : "  ·  ")}`);

  const hasQuery = Object.keys(query).length > 0;
  const hasBody = body !== null && body !== undefined && method !== "GET" && method !== "HEAD";

  if (hasQuery) {
    const val = color ? `${accent}${formatQuery(query)}${reset}` : formatQuery(query);
    console.log(`${label("params")}${val}`);
  }

  if (hasBody) {
    const bodyStr = formatBody(body);
    if (bodyStr) {
      const val = color ? `${dim}${bodyStr}${reset}` : bodyStr;
      console.log(`${label("body")}${val}`);
    }
  }
}

export function printGuestListenEnd(reason: "events" | "time", color: boolean = useColor()): void {
  const dim = color ? DIM : "";
  const accent = color ? ACCENT : "";
  const reset = color ? RESET : "";
  const line = color ? `${dim}──────────────────────────────────────────────${reset}` : "──────────────────────────────────────────────";
  console.log("");
  console.log(line);
  if (reason === "events") {
    console.log(
      color
        ? `  ${dim}Guest session ended — event limit reached.${reset}`
        : "  Guest session ended — event limit reached.",
    );
  } else {
    console.log(
      color
        ? `  ${dim}Guest session ended — time limit reached.${reset}`
        : "  Guest session ended — time limit reached.",
    );
  }
  console.log("");
  console.log(
    color
      ? `    ${accent}eventpipe login${reset} ${dim}— unlimited listen, same account as the web app${reset}`
      : "    eventpipe login — unlimited listen, same account as the web app",
  );
  console.log(line);
  console.log("");
}
