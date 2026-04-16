# Event Pipe MCP — setup

## One-command setup

```bash
eventpipe mcp setup
```

This automatically:
1. Logs you in (if needed).
2. Creates an API key for MCP (`evp_…`).
3. Saves it to `~/.eventpipe/mcp.json` (chmod 600).
4. Writes `.cursor/mcp.json` with the MCP server entry.
5. Installs the Cursor skill (`eventpipe-debug`).

After running, restart Cursor. The MCP server (`eventpipe mcp-serve`) is spawned automatically by Cursor.

## Environment (alternative to setup)

If you prefer manual config, set these in the MCP server entry:

| Variable | Purpose |
|----------|---------|
| `EVENTPIPE_BASE_URL` | App origin (default `https://eventpipe.app`). |
| `EVENTPIPE_API_KEY` | Account API key from Account → API keys. |

## Revoking access

Delete or revoke the key from **Account → API keys** in the dashboard. Remove `~/.eventpipe/mcp.json` and the `eventpipe` entry from `.cursor/mcp.json`.
