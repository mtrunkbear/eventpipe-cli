export function collectCodeNodeIds(pipe: unknown): string[] {
  if (typeof pipe !== "object" || pipe === null) {
    return [];
  }
  const nodes = (pipe as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    return [];
  }
  const out: string[] = [];
  for (const n of nodes) {
    if (typeof n !== "object" || n === null) {
      continue;
    }
    const rec = n as Record<string, unknown>;
    if (rec.type === "code" && typeof rec.id === "string") {
      out.push(rec.id);
    }
  }
  return out;
}
