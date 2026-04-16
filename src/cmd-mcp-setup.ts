import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { loadCredentials } from "./credentials.js";
import { fetchWithSession } from "./auth-fetch.js";
import { cmdLogin } from "./cmd-login.js";
import { cmdInstallCursorSkill } from "./cmd-install-cursor-skill.js";

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
      body: JSON.stringify({ label: "Cursor MCP (auto)" }),
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

async function writeCursorMcpConfig(projectDir: string): Promise<string> {
  const cursorDir = join(projectDir, ".cursor");
  const configPath = join(cursorDir, "mcp.json");

  const entry = {
    command: "eventpipe",
    args: ["mcp-serve"],
  };

  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* file doesn't exist yet */
  }

  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  servers["eventpipe"] = entry;
  existing.mcpServers = servers;

  await mkdir(cursorDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
  return configPath;
}

async function skillAlreadyInstalled(projectDir: string): Promise<boolean> {
  try {
    await stat(join(projectDir, ".cursor", "skills", "eventpipe-debug", "SKILL.md"));
    return true;
  } catch {
    return false;
  }
}

export async function cmdMcpSetup(argv: string[]): Promise<void> {
  let projectDir = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--dir" || argv[i] === "-C") && argv[i + 1]) {
      projectDir = resolve(argv[++i]!.trim());
    }
  }

  console.log("── eventpipe MCP setup ──\n");

  const cred = await ensureLogin();

  console.log("Creating API key for MCP…");
  const mcpCfg = await createApiKey(cred);
  await saveMcpKey(mcpCfg);
  console.log(`API key saved to ${MCP_KEY_PATH()} (chmod 600)\n`);

  const configPath = await writeCursorMcpConfig(projectDir);
  console.log(`Cursor MCP config written to ${configPath}\n`);

  if (!(await skillAlreadyInstalled(projectDir))) {
    console.log("Installing Cursor skill (eventpipe-debug)…");
    await cmdInstallCursorSkill(["--dir", projectDir, "--force"]);
    console.log("");
  }

  console.log("── Setup complete ──\n");
  console.log("Next steps:");
  console.log("  1. Restart Cursor (or reload window).");
  console.log("  2. In chat, ask: \"list my pipelines\" to verify.\n");
  console.log(`API key prefix: ${mcpCfg.apiKey.slice(0, 14)}…`);
  console.log("Revoke anytime from Account → API keys in the dashboard.");
}
