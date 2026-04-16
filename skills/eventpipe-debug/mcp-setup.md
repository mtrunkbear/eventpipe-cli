# Event Pipe MCP — Cursor setup

When an official **`@eventpipe/mcp`** package (or your own server) exists, add it to Cursor MCP settings so agents can call tools instead of hand-written `curl`.

## Environment

| Variable | Purpose |
|----------|---------|
| `EVENTPIPE_BASE_URL` | App origin (e.g. `https://eventpipe.app`). |
| `EVENTPIPE_API_KEY` | Account API key from the dashboard. |

## Example (conceptual)

Point **`command`** at your MCP server entry (Node binary or `npx -y @eventpipe/mcp`). Pass the env vars above in the MCP server block so tools can reach `/api/account/pipelines/...`.

Exact file location depends on Cursor version (user-level MCP config vs project). Use **Cursor Settings → MCP** when available, or merge the server definition into your existing MCP JSON.

## Relation to this skill

- **Skill** (`eventpipe-debug`): teaches workflows (CLI + API + when to use MCP).
- **MCP server**: exposes concrete tools (`get_pipeline`, `execute_pipeline`, etc.) with structured results.

Use both: the skill for behavior; MCP for actions.
