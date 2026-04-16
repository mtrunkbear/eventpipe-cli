import { mkdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadCredentials } from "./credentials.js";
import { fetchWithSession } from "./auth-fetch.js";
import { cmdLogin } from "./cmd-login.js";
import { cmdInstallCursorSkill } from "./cmd-install-cursor-skill.js";
import {
  type McpClientId,
  MCP_CLIENT_IDS,
  claudeDesktopConfigPath,
  mcpServerEntry,
  mergeMcpServersJson,
  upsertClaudeMdSection,
} from "./mcp-client-config.js";

type McpKeyFile = { apiKey: string; baseUrl: string };

const MCP_KEY_PATH = () => join(homedir(), ".eventpipe", "mcp.json");

async function ensureLogin() {
  let cred = await loadCredentials();
  if (!cred) {
    console.log("No session found. Starting login…\n");
    await cmdLogin();
    cred = await loadCredentials();
  }
  if (!cred) {
    throw new Error("Login failed — cannot continue MCP setup.");
  }
  return cred;
}

async function createApiKey(cred: Awaited<ReturnType<typeof loadCredentials>>) {
  if (!cred) throw new Error("Not logged in");

  const { response, credentials } = await fetchWithSession(
    `${cred.baseUrl}/api/account/api-keys`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "eventpipe MCP (auto)" }),
    },
    cred,
  );

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to create API key (${response.status})`);
  }

  const data = (await response.json()) as { key?: string };
  if (!data.key) {
    throw new Error("Server did not return an API key");
  }

  return { apiKey: data.key, baseUrl: credentials.baseUrl };
}

async function saveMcpKey(cfg: McpKeyFile): Promise<void> {
  const dir = join(homedir(), ".eventpipe");
  await mkdir(dir, { recursive: true });
  await writeFile(MCP_KEY_PATH(), JSON.stringify(cfg, null, 2), "utf8");
  try {
    const { chmod } = await import("node:fs/promises");
    await chmod(MCP_KEY_PATH(), 0o600);
  } catch {
    /* windows or permission issue — non-fatal */
  }
}

async function skillAlreadyInstalled(projectDir: string): Promise<boolean> {
  try {
    await stat(join(projectDir, ".cursor", "skills", "eventpipe-debug", "SKILL.md"));
    return true;
  } catch {
    return false;
  }
}

function parseClients(argv: string[]): { projectDir: string; clients: Set<McpClientId> } {
  let projectDir = process.cwd();
  const clients = new Set<McpClientId>();
  let allClients = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--dir" || a === "-C") && argv[i + 1]) {
      projectDir = resolve(argv[++i]!.trim());
      continue;
    }
    if (a === "--all-clients") {
      allClients = true;
      continue;
    }
    if (a === "--client" && argv[i + 1]) {
      const id = argv[++i]!.trim() as McpClientId;
      if (!MCP_CLIENT_IDS.includes(id)) {
        throw new Error(
          `Unknown --client "${id}". Use: ${MCP_CLIENT_IDS.join(", ")}`,
        );
      }
      clients.add(id);
    }
  }

  if (allClients) {
    for (const c of MCP_CLIENT_IDS) clients.add(c);
  }
  if (clients.size === 0) {
    clients.add("cursor");
  }

  return { projectDir, clients };
}

export async function cmdMcpSetup(argv: string[]): Promise<void> {
  const { projectDir, clients } = parseClients(argv);
  const entry = mcpServerEntry();

  console.log("── eventpipe MCP setup ──\n");
  console.log(`Clients: ${[...clients].join(", ")}\n`);

  const cred = await ensureLogin();

  console.log("Creating API key for MCP…");
  const mcpCfg = await createApiKey(cred);
  await saveMcpKey(mcpCfg);
  console.log(`API key saved to ${MCP_KEY_PATH()} (chmod 600)\n`);

  if (clients.has("cursor")) {
    const configPath = join(projectDir, ".cursor", "mcp.json");
    await mergeMcpServersJson(configPath, "eventpipe", entry);
    console.log(`Cursor MCP config written to ${configPath}`);
  }

  if (clients.has("claude-code")) {
    const configPath = join(projectDir, ".mcp.json");
    await mergeMcpServersJson(configPath, "eventpipe", entry);
    console.log(`Claude Code / project MCP config written to ${configPath}`);
    const claudePath = await upsertClaudeMdSection(projectDir);
    console.log(`CLAUDE.md updated with Event Pipe hints: ${claudePath}`);
  }

  if (clients.has("claude-desktop")) {
    const desktopPath = claudeDesktopConfigPath();
    if (!desktopPath) {
      console.warn(
        "Skipping Claude Desktop: could not resolve config path (set APPDATA on Windows).",
      );
    } else {
      await mergeMcpServersJson(desktopPath, "eventpipe", entry);
      console.log(`Claude Desktop MCP config merged into ${desktopPath}`);
    }
  }

  console.log("");

  if (clients.has("cursor") && !(await skillAlreadyInstalled(projectDir))) {
    console.log("Installing Cursor skill (eventpipe-debug)…");
    await cmdInstallCursorSkill(["--dir", projectDir, "--force"]);
    console.log("");
  }

  console.log("── Setup complete ──\n");
  console.log("Next steps:");
  if (clients.has("cursor")) {
    console.log("  • Cursor: restart Cursor (or reload window).");
  }
  if (clients.has("claude-code")) {
    console.log(
      "  • Claude Code: ensure `eventpipe` is on your PATH; open this project and use /mcp if needed.",
    );
  }
  if (clients.has("claude-desktop")) {
    console.log("  • Claude Desktop: fully quit and reopen the app.");
  }
  console.log('  • In chat, try: "list my pipelines" (or use MCP tools from the tool menu).\n');
  console.log(`API key prefix: ${mcpCfg.apiKey.slice(0, 14)}…`);
  console.log("Revoke anytime from Account → API keys in the dashboard.");
}
