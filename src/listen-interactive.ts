import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import type { ListenOptions } from "./listen-args.js";

const DEFAULT_FORWARD_URL = "http://127.0.0.1:3000/api/webhooks";

const PLACEHOLDER_FIRST = [
  "monkey",
  "cosmic",
  "turbo",
  "neon",
  "fuzzy",
  "lazy",
  "wild",
  "tiny",
  "cyber",
  "quantum",
  "jolly",
  "stealth",
  "hyper",
  "pixel",
  "astro",
  "silent",
  "pickle",
  "rapid",
  "muffin",
  "penguin",
] as const;

const PLACEHOLDER_SECOND = [
  "ninja",
  "badger",
  "llama",
  "rocket",
  "wizard",
  "pirate",
  "otter",
  "cobra",
  "falcon",
  "yeti",
  "goblin",
  "robot",
  "kraken",
  "troll",
  "hamster",
  "platypus",
] as const;

function pick<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomHex5(): string {
  return randomBytes(3).toString("hex").slice(0, 5);
}

export function randomListenPlaceholderName(): string {
  const a = pick(PLACEHOLDER_FIRST);
  const b = pick(PLACEHOLDER_SECOND);
  return `${a}-${b}-${randomHex5()}`;
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
