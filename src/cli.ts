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
import { loadCredentials } from "./credentials.js";
import {
  fetchLatestPublishedVersion,
  isPublishedVersionNewer,
  readInstalledCliVersion,
} from "./cli-version.js";
import { cmdUpdate } from "./cmd-update.js";
import { cmdListen } from "./cmd-listen.js";
import { cmdInstallCursorSkill } from "./cmd-install-cursor-skill.js";
import { cmdMcpSetup } from "./cmd-mcp-setup.js";
import { parseListenArgv, type ListenOptions } from "./listen-args.js";
import { defaultBaseUrlHint, printUsage } from "./cli-style.js";

async function usage(exitCode: number): Promise<void> {
  const version = await readInstalledCliVersion();
  printUsage(version, defaultBaseUrlHint());
  process.exit(exitCode);
}

async function maybeSuggestUpdate(): Promise<void> {
  try {
    if (process.env.EVENTPIPE_SKIP_UPDATE_CHECK === "1") {
      return;
    }
    const v = await readInstalledCliVersion();
    const latest = await fetchLatestPublishedVersion();
    if (!latest || !isPublishedVersionNewer(v, latest)) {
      return;
    }
    console.error(
      `\nA newer @eventpipe/cli is available (latest: ${latest}). Run: eventpipe update\n`,
    );
  } catch {
    /* ignore */
  }
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
  const cred = await loadCredentials();
  if (!cred) {
    throw new Error("Run eventpipe login before push");
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
    cred,
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
    const exitCode = cmd && cmd !== "help" ? 0 : 1;
    await usage(exitCode);
    return;
  }

  if (cmd === "-v" || cmd === "--version") {
    const v = await readInstalledCliVersion();
    console.log(v);
    return;
  }

  if (cmd === "login") {
    await cmdLogin();
    void maybeSuggestUpdate();
    return;
  }

  if (cmd === "create") {
    await cmdCreate(argv.slice(1));
    void maybeSuggestUpdate();
    return;
  }

  if (cmd === "update") {
    await cmdUpdate();
    return;
  }

  if (cmd === "install-cursor-skill") {
    await cmdInstallCursorSkill(argv.slice(1));
    void maybeSuggestUpdate();
    return;
  }

  if (cmd === "mcp-serve") {
    const { startMcpServer } = await import("./mcp-serve.js");
    await startMcpServer();
    return;
  }

  if (cmd === "mcp") {
    const sub = argv[1];
    if (sub === "setup") {
      await cmdMcpSetup(argv.slice(2));
      void maybeSuggestUpdate();
      return;
    }
    if (sub === "serve") {
      const { startMcpServer } = await import("./mcp-serve.js");
      await startMcpServer();
      return;
    }
    console.error("Usage: eventpipe mcp <setup|serve>");
    process.exit(1);
  }

  if (cmd === "listen") {
    let parsed: { webhookId: string; options: ListenOptions };
    try {
      parsed = parseListenArgv(argv.slice(1));
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      console.error(
        "Usage: eventpipe listen [webhookId] [--verbose|-v] [--json] [--forward-to <url>]",
      );
      process.exit(1);
    }
    void maybeSuggestUpdate();
    await cmdListen(parsed.webhookId, parsed.options);
    return;
  }

  const projectDir = parseDir(argv);
  const pipelineOverride = parsePipelineOverride(argv);

  if (cmd === "build") {
    await cmdBuild(projectDir);
    void maybeSuggestUpdate();
    return;
  }
  if (cmd === "push") {
    await cmdPush(projectDir, pipelineOverride);
    void maybeSuggestUpdate();
    return;
  }

  await usage(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
