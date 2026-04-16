# Event Pipe MCP — setup

## One-command setup

```bash
eventpipe mcp setup
```

By default configures **all** clients: Cursor (`.cursor/mcp.json` + Cursor skill), Claude Code (`.mcp.json` + `CLAUDE.md`), and Claude Desktop (app config). For **Cursor only**:

```bash
eventpipe mcp setup --client cursor
```

This automatically:
1. Logs you in (if needed).
2. Creates an API key for MCP (`evp_…`, labeled **eventpipe MCP (auto)** in the dashboard).
3. Saves it to `~/.eventpipe/mcp.json` (chmod 600).
4. Merges the MCP server entry (`eventpipe` → `eventpipe mcp-serve`) into each selected client config.
5. Installs the Cursor skill (`eventpipe-debug`) when **cursor** is selected and the skill is missing.

After running, restart the editor or Claude Desktop. The MCP server (`eventpipe mcp-serve`) is spawned by the client; `eventpipe` must be on `PATH`.

## Environment (alternative to setup)

If you prefer manual config, set these in the MCP server entry:

| Variable | Purpose |
|----------|---------|
| `EVENTPIPE_BASE_URL` | App origin (default `https://eventpipe.app`). |
| `EVENTPIPE_API_KEY` | Account API key from Account → API keys. |

## Revoking access

Delete or revoke the key from **Account → API keys** in the dashboard. Remove `~/.eventpipe/mcp.json` and the `eventpipe` entry from each config you wrote (`.cursor/mcp.json`, `.mcp.json`, Claude Desktop `claude_desktop_config.json`).
