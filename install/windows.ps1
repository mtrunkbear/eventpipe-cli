#Requires -Version 5.0
$ErrorActionPreference = "Stop"

$MinNodeMajor = 20

function Need-Node {
    throw "Node.js $MinNodeMajor+ is required. Install from https://nodejs.org/ or use nvm-windows."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Need-Node
}

try {
    $ver = node -p "parseInt(process.versions.node.split('.')[0], 10)"
    if ([int]$ver -lt $MinNodeMajor) {
        Write-Error "Node.js $MinNodeMajor+ is required (found $(node -v))."
    }
} catch {
    Need-Node
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is required but not found in PATH."
}

Write-Host "Installing @eventpipe/cli globally..."
npm install -g @eventpipe/cli@latest

Write-Host ""
$ep = Get-Command eventpipe -ErrorAction SilentlyContinue
if ($ep) {
    Write-Host "Installed: $($ep.Source)"
}
eventpipe --version
