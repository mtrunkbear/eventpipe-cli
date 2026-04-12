#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBundle } from "./build-bundle.js";
import { collectCodeNodeIds } from "./code-node-ids.js";
import { loadManifest, type EventpipeManifest } from "./config.js";
import { publishVersion } from "./publish.js";
import { applyPublishedStudioSources, codeNodeUsesLibrary } from "./studio-sources.js";
import { cmdLogin } from "./cmd-login.js";
import { cmdCreate } from "./cmd-create.js";
import { cmdListen } from "./cmd-listen.js";
import { parseListenArgv, type ListenOptions } from "./listen-args.js";

function usage() {
  console.log(`eventpipe — Event Pipe CLI

Environment:
  EVENTPIPE_BASE_URL   App origin (e.g. https://app.example.com), required for login/create/listen
  EVENTPIPE_API_KEY    Account API key (x-api-key) for push when not using session

Commands:
  login                  Browser login (stores ~/.eventpipe/credentials.json)
  create [--name <s>]    Create a webhook endpoint (requires login)
  listen <webhookId> [--verbose|-v] [--json] [--forward-to <url>]
                         Stream webhooks; --verbose prints full JSON event; --json one NDJSON line per event;
                         --forward-to replays the request to your local server (status on stderr)
  build [--dir <path>]   Bundle TS into .eventpipe/
  push [--dir <path>]    build + POST /api/account/pipelines/:id/versions (needs EVENTPIPE_API_KEY)
  help

eventpipe.json must define pipelineId and settings.pipe (v3) for build/push.
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

function parsePipelineOverride(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--pipeline" || argv[i] === "--flow") && argv[i + 1]) {
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
    "Multiple code nodes detected in your flow. You must specify a 'codeNodes' map in eventpipe.json (e.g. { \"src/node.ts\": \"uuid\" }).",
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

async function cmdPush(projectDir: string, pipelineOverride: string | undefined) {
  const base = process.env.EVENTPIPE_BASE_URL?.replace(/\/$/, "");
  const key = process.env.EVENTPIPE_API_KEY?.trim();
  if (!base || !key) {
    throw new Error("EVENTPIPE_BASE_URL and EVENTPIPE_API_KEY are required");
  }
  const manifest = await loadManifest(projectDir);
  const pipelineId = pipelineOverride ?? manifest.pipelineId;
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
    pipelineId,
    manifest: manifestForPublish,
    bundles,
    sourceCode,
  });

  if (result.error) {
    throw new Error(result.error);
  }
  console.log(
    `Published pipeline ${pipelineId} version ${result.version} (${result.bundleSizeBytes ?? totalSize} bytes in ${bundles.length} bundles)`,
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    usage();
    process.exit(cmd && cmd !== "help" ? 0 : 1);
  }

  if (cmd === "login") {
    await cmdLogin();
    return;
  }

  if (cmd === "create") {
    await cmdCreate(argv.slice(1));
    return;
  }

  if (cmd === "listen") {
    let parsed: { webhookId: string; options: ListenOptions };
    try {
      parsed = parseListenArgv(argv.slice(1));
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      console.error(
        "Usage: eventpipe listen <webhookId> [--verbose|-v] [--json] [--forward-to <url>]",
      );
      process.exit(1);
    }
    if (!parsed.webhookId) {
      console.error(
        "Usage: eventpipe listen <webhookId> [--verbose|-v] [--json] [--forward-to <url>]",
      );
      process.exit(1);
    }
    await cmdListen(parsed.webhookId, parsed.options);
    return;
  }

  const projectDir = parseDir(argv);
  const pipelineOverride = parsePipelineOverride(argv);

  if (cmd === "build") {
    await cmdBuild(projectDir);
    return;
  }
  if (cmd === "push") {
    await cmdPush(projectDir, pipelineOverride);
    return;
  }

  usage();
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
