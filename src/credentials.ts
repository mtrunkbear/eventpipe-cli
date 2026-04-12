import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type StoredCredentials = {
  baseUrl: string;
  accessToken: string;
  refreshToken: string;
};

const dir = () => join(homedir(), ".eventpipe");
const filePath = () => join(dir(), "credentials.json");

export async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const data = JSON.parse(raw) as Partial<StoredCredentials>;
    if (
      typeof data.baseUrl === "string" &&
      typeof data.accessToken === "string" &&
      typeof data.refreshToken === "string"
    ) {
      return {
        baseUrl: data.baseUrl.replace(/\/$/, ""),
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveCredentials(c: StoredCredentials): Promise<void> {
  await mkdir(dir(), { recursive: true });
  const normalized: StoredCredentials = {
    ...c,
    baseUrl: c.baseUrl.replace(/\/$/, ""),
  };
  await writeFile(filePath(), JSON.stringify(normalized, null, 2), "utf8");
  try {
    await chmodSafe(filePath());
  } catch {
    /* ignore */
  }
}

async function chmodSafe(path: string): Promise<void> {
  const { chmod } = await import("node:fs/promises");
  await chmod(path, 0o600);
}
