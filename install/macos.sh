#!/usr/bin/env bash
set -euo pipefail

MIN_NODE_MAJOR=20

need_node() {
  echo "Node.js ${MIN_NODE_MAJOR}+ is required. Install from https://nodejs.org/ or use nvm:" >&2
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash" >&2
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  need_node
fi

major="$(node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>/dev/null || echo 0)"
if [ "${major}" -lt "${MIN_NODE_MAJOR}" ]; then
  echo "Node.js ${MIN_NODE_MAJOR}+ is required (found $(node -v))." >&2
  need_node
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found in PATH." >&2
  exit 1
fi

echo "Installing @eventpipe/cli globally..."
npm install -g @eventpipe/cli@latest

echo ""
echo "Installed: $(command -v eventpipe)"
eventpipe --version
