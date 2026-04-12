const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BANNER_LINES = [
  "  _______     _______ _   _ _____ ____ ___ ____  _____ ",
  " | ____\\ \\   / / ____| \\ | |_   _|  _ \\_ _|  _ \\| ____|",
  " |  _|  \\ \\ / /|  _| |  \\| | | | | |_) | || |_) |  _|  ",
  " | |___  \\ V / | |___| |\\  | | | |  __/| ||  __/| |___ ",
  " |_____|  \\_/ |_____|_| \\_| |_| |_|  |___|_|   |_____|",
  "                                                       ",
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
    ? `${DIM}Event Pipe CLI — build, stream, and publish.${RESET}`
    : "Event Pipe CLI — build, stream, and publish.";
  console.log(title);
  console.log("");

  console.log(color ? `${DIM}Tips for getting started:${RESET}` : "Tips for getting started:");
  const t1 = color ? `${DIM}1.${RESET} Run ${ACCENT}eventpipe login${RESET} to authenticate in the browser.` : "1. Run eventpipe login to authenticate in the browser.";
  const t2 = color
    ? `${DIM}2.${RESET} Use ${ACCENT}eventpipe listen <webhookId>${RESET} to stream webhooks locally.`
    : "2. Use eventpipe listen <webhookId> to stream webhooks locally.";
  const t3 = color
    ? `${DIM}3.${RESET} ${ACCENT}eventpipe help${RESET} for all commands and flags.`
    : "3. eventpipe help for all commands and flags.";
  console.log(`  ${t1}`);
  console.log(`  ${t2}`);
  console.log(`  ${t3}`);
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
      name: "listen <webhookId> [--verbose|-v] [--json] [--forward-to <url>]",
      desc: [
        "Stream webhooks; --verbose prints full JSON event; --json one NDJSON line per event;",
        "--forward-to replays the request to your local server (status on stderr)",
      ],
    },
    { name: "build [--dir <path>]", desc: ["Bundle TS into .eventpipe/"] },
    { name: "push [--dir <path>]", desc: ["build + publish (requires eventpipe login)"] },
    { name: "update", desc: ["npm install -g @eventpipe/cli@latest"] },
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
