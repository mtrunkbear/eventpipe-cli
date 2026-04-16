import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type McpClientId = "cursor" | "claude-code" | "claude-desktop";

export const MCP_CLIENT_IDS: readonly McpClientId[] = [
  "cursor",
  "claude-code",
  "claude-desktop",
];

export function mcpServerEntry(): { command: string; args: string[] } {
  return {
    command: "eventpipe",
    args: ["mcp-serve"],
  };
}

export async function mergeMcpServersJson(
  configPath: string,
  serverKey: string,
  entry: { command: string; args: string[] },
): Promise<void> {
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, "utf8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* missing or invalid — start fresh */
  }

  const servers = (existing.mcpServers ?? {}) as Record<string, unknown>;
  servers[serverKey] = entry;
  existing.mcpServers = servers;

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
}

export function claudeDesktopConfigPath(): string | null {
  const h = homedir();
  if (process.platform === "darwin") {
    return join(h, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA?.trim();
    if (!appData) return null;
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  return join(h, ".config", "Claude", "claude_desktop_config.json");
}

const CLAUDE_MD_MARK_BEGIN = "<!-- eventpipe-mcp-begin -->";
const CLAUDE_MD_MARK_END = "<!-- eventpipe-mcp-end -->";

const CLAUDE_MD_BODY = `${CLAUDE_MD_MARK_BEGIN}
## Event Pipe (MCP)

When the **eventpipe** MCP server is configured, prefer these tools over ad-hoc API calls:

| Tool | Use |
|------|-----|
| \`list_endpoints\` | Webhook endpoints for the account |
| \`list_pipelines\` | Pipelines for an endpoint (\`endpointId\`) |
| \`get_pipeline\` | Pipeline detail and \`settings.pipe\` (\`pipelineId\` UUID) |
| \`execute_pipeline\` | Run live handler with a test payload |
| \`list_executions\` / \`get_execution\` / \`get_request_executions\` | Production runs and errors |

Resources: \`eventpipe://guide/debug-local\`, \`eventpipe://guide/ids\`.

CLI (after \`eventpipe login\`): \`eventpipe listen <webhookId>\`, \`--forward-to\` for local replay, \`eventpipe build\` / \`eventpipe push\` for deploy.

${CLAUDE_MD_MARK_END}
`;

export async function upsertClaudeMdSection(projectDir: string): Promise<string | null> {
  const path = join(projectDir, "CLAUDE.md");
  let before = "";
  try {
    before = await readFile(path, "utf8");
  } catch {
    /* new file */
  }

  const next = before.includes(CLAUDE_MD_MARK_BEGIN)
    ? before.replace(
        new RegExp(
          `${CLAUDE_MD_MARK_BEGIN}[\\s\\S]*?${CLAUDE_MD_MARK_END}`,
          "m",
        ),
        CLAUDE_MD_BODY.trimEnd(),
      )
    : `${before.trimEnd()}${before.trim() ? "\n\n" : ""}${CLAUDE_MD_BODY}\n`;

  await writeFile(path, next, "utf8");
  return path;
}
