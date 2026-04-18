import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import type { ListenOptions } from "./listen-args.js";

const DEFAULT_FORWARD_URL = "http://127.0.0.1:3000/api/webhooks";

export function randomListenPlaceholderName(): string {
  return `listen-${randomBytes(4).toString("hex")}`;
}

export async function promptListenInteractive(
  options: ListenOptions,
): Promise<{ displayName: string; options: ListenOptions }> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Webhook id is required when logged in (stdin is not interactive; pass <webhookId> or use eventpipe create first)",
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const placeholder = randomListenPlaceholderName();
    const nameLine = await rl.question(`Endpoint name [${placeholder}]: `);
    const displayName = nameLine.trim() || placeholder;

    let forwardTo = options.forwardTo;
    if (!forwardTo) {
      const yn = (await rl.question("Forward webhooks to a local URL? [y/N]: ")).trim().toLowerCase();
      if (yn === "y" || yn === "yes") {
        const urlLine = await rl.question(`Local URL [${DEFAULT_FORWARD_URL}]: `);
        forwardTo = urlLine.trim() || DEFAULT_FORWARD_URL;
      }
    }

    return {
      displayName,
      options: { ...options, forwardTo },
    };
  } finally {
    rl.close();
  }
}
