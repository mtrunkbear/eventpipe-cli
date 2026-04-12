#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBundle } from "./build-bundle.js";
import { collectCodeNodeIds } from "./code-node-ids.js";
import { loadManifest, type EventpipeManifest } from "./config.js";
import { publishVersion } from "./publish.js";
import { applyPublishedStudioSources, codeNodeUsesLibrary } from "./studio-sources.js";

function usage() {
  console.log(`eventpipe — Event Pipe CLI

Environment:
  EVENTPIPE_BASE_URL   Dashboard origin (e.g. https://app.example.com)
  EVENTPIPE_API_KEY    Account API key (header x-api-key)

Commands:
  build [--dir <path>]     Bundle target TS files into .eventpipe/
  push [--dir <path>]      build + POST /api/account/pipelines/:flowId/versions
  help

eventpipe.json must define flowId and settings.pipe (v3).
If your flow has multiple code boxes, you must specify a 'codeNodes' map mapping your source files to node IDs.
Default entry: src/handler.ts — export async function handler(event, context).
`);
}

function parseDir(argv: string[]): string {
  let dir = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) {
      dir = resolve(argv[++i]);
    }
  }
  return dir;
}

function parseFlowOverride(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--flow" && argv[i + 1]) {
      return argv[++i].trim();
    }
  }
  return undefined;
}

function resolveTargets(manifest: EventpipeManifest, ids: string[]): Record<string, string> {
  if (manifest.codeNodes) {
    return manifest.codeNodes;
  }
  const entry = manifest.entry && manifest.entry.length > 0 ? manifest.entry : "src/handler.ts";
  const nodeId = manifest.nodeId?.trim();
  if (nodeId) {
    return { [entry]: nodeId };
  }
  if (ids.length === 0) {
    throw new Error("No code node ids found in settings.pipe");
  }
  if (ids.length === 1) {
    return { [entry]: ids[0] };
  }
  throw new Error(
    "Multiple code nodes detected in your flow. You must specify a 'codeNodes' map in eventpipe.json (e.g. { \"src/node.ts\": \"uuid\" })."
  );
}

async function cmdBuild(projectDir: string) {
  const manifest = await loadManifest(projectDir);
  const pipe = manifest.settings.pipe;
  const ids = collectCodeNodeIds(pipe);
  const targets = resolveTargets(manifest, ids);

  for (const [entryRelative, nodeId] of Object.entries(targets)) {
    const r = await buildBundle({
      projectDir,
      entryRelative,
      nodeId,
      pipe,
    });
    console.log(`OK bundle (${entryRelative} -> ${nodeId}) ${r.bundleSizeBytes} bytes sha256:${r.bundleHash.slice(0, 12)}…`);
    console.log(`Written ${r.outFile}`);
  }
}

async function cmdPush(projectDir: string, flowOverride: string | undefined) {
  const base = process.env.EVENTPIPE_BASE_URL?.replace(/\/$/, "");
  const key = process.env.EVENTPIPE_API_KEY?.trim();
  if (!base || !key) {
    throw new Error("EVENTPIPE_BASE_URL and EVENTPIPE_API_KEY are required");
  }
  const manifest = await loadManifest(projectDir);
  const flowId = flowOverride ?? manifest.flowId;
  const pipe = manifest.settings.pipe;
  const ids = collectCodeNodeIds(pipe);
  const targets = resolveTargets(manifest, ids);

  const bundles: Array<{ nodeId: string; bundleCode: string; bundleHash: string }> = [];
  const sourcesByNodeId: Record<string, string> = {};

  let totalSize = 0;
  for (const [entryRelative, nodeId] of Object.entries(targets)) {
    const sourcePath = resolve(projectDir, entryRelative);
    sourcesByNodeId[nodeId] = await readFile(sourcePath, "utf8");
    const built = await buildBundle({
      projectDir,
      entryRelative,
      nodeId,
      pipe,
    });
    bundles.push({
      nodeId,
      bundleCode: built.bundleCode,
      bundleHash: built.bundleHash,
    });
    totalSize += built.bundleSizeBytes;
  }

  const flowSourceCode = ids.length === 1 && ids[0] ? sourcesByNodeId[ids[0]] ?? "" : "";
  const mergedPipe = applyPublishedStudioSources(pipe, {
    sourcesByNodeId,
    flowSourceCode,
  });
  const manifestForPublish: EventpipeManifest = {
    ...manifest,
    settings: { ...manifest.settings, pipe: mergedPipe },
  };
  const sourceCode =
    ids.length > 0 && ids[0] && !codeNodeUsesLibrary(mergedPipe, ids[0])
      ? sourcesByNodeId[ids[0]] ?? null
      : null;

  const result = await publishVersion({
    baseUrl: base,
    apiKey: key,
    flowId,
    manifest: manifestForPublish,
    bundles,
    sourceCode,
  });
  
  if (result.error) {
    throw new Error(result.error);
  }
  console.log(
    `Published flow ${flowId} version ${result.version} (${result.bundleSizeBytes ?? totalSize} bytes in ${bundles.length} bundles)`,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    usage();
    process.exit(cmd && cmd !== "help" ? 0 : 1);
  }
  const projectDir = parseDir(argv);
  const flowOverride = parseFlowOverride(argv);

  if (cmd === "build") {
    await cmdBuild(projectDir);
    return;
  }
  if (cmd === "push") {
    await cmdPush(projectDir, flowOverride);
    return;
  }
  usage();
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
