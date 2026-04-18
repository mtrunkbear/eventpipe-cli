import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type GuestListenSession = {
  baseUrl: string;
  webhookId: string;
  guestCliToken: string;
};

const dir = () => join(homedir(), ".eventpipe");
const filePath = () => join(dir(), "guest-listen.json");

export async function loadGuestListenSession(baseUrl: string): Promise<GuestListenSession | null> {
  const normalized = baseUrl.replace(/\/$/, "");
  try {
    const raw = await readFile(filePath(), "utf8");
    const data = JSON.parse(raw) as Partial<GuestListenSession>;
    if (
      typeof data.baseUrl === "string" &&
      typeof data.webhookId === "string" &&
      typeof data.guestCliToken === "string" &&
      data.baseUrl.replace(/\/$/, "") === normalized
    ) {
      return {
        baseUrl: normalized,
        webhookId: data.webhookId,
        guestCliToken: data.guestCliToken,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function saveGuestListenSession(s: GuestListenSession): Promise<void> {
  await mkdir(dir(), { recursive: true });
  const normalized: GuestListenSession = {
    baseUrl: s.baseUrl.replace(/\/$/, ""),
    webhookId: s.webhookId,
    guestCliToken: s.guestCliToken,
  };
  await writeFile(filePath(), JSON.stringify(normalized, null, 2), "utf8");
  try {
    const { chmod } = await import("node:fs/promises");
    await chmod(filePath(), 0o600);
  } catch {
    /* ignore */
  }
}

export async function clearGuestListenSession(): Promise<void> {
  try {
    await unlink(filePath());
  } catch {
    /* ignore */
  }
}
