import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NPM_LATEST_URL = "https://registry.npmjs.org/@eventpipe%2fcli/latest";

export async function readInstalledCliVersion(): Promise<string> {
  const dir = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(dir, "..", "package.json");
  const raw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

export async function fetchLatestPublishedVersion(): Promise<string | null> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5_000);
    const res = await fetch(NPM_LATEST_URL, {
      signal: ac.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(t);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

function compareSemverLike(a: string, b: string): number {
  const coreA = a.replace(/^v/, "").split(/[-+]/)[0] ?? "0";
  const coreB = b.replace(/^v/, "").split(/[-+]/)[0] ?? "0";
  const partsA = coreA.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const partsB = coreB.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const n = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < n; i++) {
    const da = partsA[i] ?? 0;
    const db = partsB[i] ?? 0;
    if (da !== db) {
      return da - db;
    }
  }
  return 0;
}

export function isPublishedVersionNewer(installed: string, published: string): boolean {
  return compareSemverLike(published, installed) > 0;
}

