import { collectCodeNodeIds } from "./code-node-ids.js";

const STUDIO_SOURCE_MAX_CHARS = 400_000;

export function codeNodeUsesLibrary(pipe: unknown, nodeId: string): boolean {
  if (typeof pipe !== "object" || pipe === null) {
    return false;
  }
  const nodes = (pipe as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    return false;
  }
  for (const n of nodes) {
    if (typeof n !== "object" || n === null) {
      continue;
    }
    const rec = n as Record<string, unknown>;
    if (rec.type === "code" && rec.id === nodeId) {
      const cfg = rec.config;
      if (typeof cfg !== "object" || cfg === null) {
        return false;
      }
      const v = (cfg as Record<string, unknown>).libraryArtifactVersionId;
      return typeof v === "string" && v.length > 0;
    }
  }
  return false;
}

export function applyPublishedStudioSources(
  pipe: unknown,
  params: { sourcesByNodeId: Record<string, string>; flowSourceCode: string },
): unknown {
  if (typeof pipe !== "object" || pipe === null) {
    return pipe;
  }
  const p = pipe as Record<string, unknown>;
  const nodesRaw = p.nodes;
  if (!Array.isArray(nodesRaw)) {
    return pipe;
  }
  const ids = collectCodeNodeIds(pipe);
  const single = ids.length === 1;
  const newNodes = nodesRaw.map((raw) => {
    if (typeof raw !== "object" || raw === null) {
      return raw;
    }
    const n = raw as Record<string, unknown>;
    if (n.type !== "code") {
      return raw;
    }
    const id = n.id;
    if (typeof id !== "string") {
      return raw;
    }
    const prevCfg =
      typeof n.config === "object" && n.config !== null
        ? ({ ...(n.config as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    if (codeNodeUsesLibrary(pipe, id)) {
      delete prevCfg.studioSource;
      return { ...n, config: prevCfg };
    }
    const rawSrc = single ? params.flowSourceCode : (params.sourcesByNodeId[id] ?? "");
    const trimmed = typeof rawSrc === "string" ? rawSrc.slice(0, STUDIO_SOURCE_MAX_CHARS) : "";
    return {
      ...n,
      config: { ...prevCfg, studioSource: trimmed },
    };
  });
  return { ...p, nodes: newNodes };
}
