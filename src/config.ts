import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type EventpipeManifest = {
  pipelineId: string;
  nodeId?: string;
  entry?: string;
  codeNodes?: Record<string, string>;
  settings: Record<string, unknown>;
};

export async function loadManifest(projectDir: string): Promise<EventpipeManifest> {
  const path = resolve(projectDir, "eventpipe.json");
  const raw = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("eventpipe.json must be a JSON object");
  }
  const o = parsed as Record<string, unknown>;
  const pipelineId = typeof o.pipelineId === "string" ? o.pipelineId.trim() : "";
  if (!pipelineId) {
    throw new Error("eventpipe.json: pipelineId (string) is required");
  }
  const settings = o.settings;
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
    throw new Error("eventpipe.json: settings must be an object");
  }
  const pipe = (settings as Record<string, unknown>).pipe;
  if (pipe === undefined || pipe === null) {
    throw new Error("eventpipe.json: settings.pipe is required for publish");
  }

  let codeNodes: Record<string, string> | undefined = undefined;
  if (o.codeNodes !== undefined) {
    if (typeof o.codeNodes !== "object" || o.codeNodes === null || Array.isArray(o.codeNodes)) {
      throw new Error("eventpipe.json: codeNodes must be an object map (string -> string)");
    }
    codeNodes = o.codeNodes as Record<string, string>;
    for (const [k, v] of Object.entries(codeNodes)) {
      if (typeof v !== "string") {
        throw new Error(`eventpipe.json: codeNodes["${k}"] must be a string (node id)`);
      }
    }
  }

  return {
    pipelineId,
    nodeId: typeof o.nodeId === "string" ? o.nodeId.trim() : undefined,
    entry: typeof o.entry === "string" ? o.entry.trim() : undefined,
    codeNodes,
    settings: settings as Record<string, unknown>,
  };
}
