import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import * as esbuild from "esbuild";
import { collectCodeNodeIds } from "./code-node-ids.js";
import { BUNDLE_MAX_BYTES, GLOBAL_NAME } from "./constants.js";
import { byteLenUtf8, sha256Utf8 } from "./hash.js";

export type BuildResult = {
  bundleCode: string;
  bundleHash: string;
  bundleSizeBytes: number;
  outFile: string;
};

export async function buildBundle(params: {
  projectDir: string;
  entryRelative: string;
  nodeId: string;
  pipe: unknown;
}): Promise<BuildResult> {
  const codeIds = collectCodeNodeIds(params.pipe);
  if (codeIds.length === 0) {
    throw new Error("settings.pipe must contain at least one code node");
  }
  if (!codeIds.includes(params.nodeId)) {
    throw new Error(`nodeId "${params.nodeId}" is not a code node id in settings.pipe`);
  }


  const userEntry = resolve(params.projectDir, params.entryRelative);
  const epDir = resolve(params.projectDir, ".eventpipe");
  await mkdir(epDir, { recursive: true });
  const shimPath = resolve(epDir, `${params.nodeId}.reexport.ts`);
  const relToShim = relative(dirname(shimPath), userEntry).replace(/\\/g, "/");
  const shim = `export { handler } from "${relToShim}";\n`;
  await writeFile(shimPath, shim, "utf8");

  const outFile = resolve(epDir, `${params.nodeId}.bundle.js`);
  await esbuild.build({
    absWorkingDir: params.projectDir,
    entryPoints: [shimPath],
    bundle: true,
    platform: "node",
    format: "iife",
    globalName: GLOBAL_NAME,
    outfile: outFile,
    minify: true,
    target: "es2022",
    logLevel: "warning",
  });

  const raw = await readFile(outFile, "utf8");
  const footer = `\n;var handler = ${GLOBAL_NAME}.handler;\n`;
  const bundleCode = (raw + footer).trim();
  await writeFile(outFile, bundleCode, "utf8");
  if (!bundleCode.includes("handler")) {
    throw new Error("Bundle validation failed: output must reference handler");
  }
  const bundleSizeBytes = byteLenUtf8(bundleCode);
  if (bundleSizeBytes > BUNDLE_MAX_BYTES) {
    throw new Error(
      `Bundle is ${bundleSizeBytes} bytes (max ${BUNDLE_MAX_BYTES}). Use smaller dependencies or fetch-based APIs.`,
    );
  }
  const bundleHash = sha256Utf8(bundleCode);
  return { bundleCode, bundleHash, bundleSizeBytes, outFile };
}
