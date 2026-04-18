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
  "rusty",
  "sneaky",
  "sleepy",
  "spicy",
  "brave",
  "clumsy",
  "elite",
  "hollow",
  "icy",
  "lucky",
  "muddy",
  "dusty",
  "bouncy",
  "grumpy",
  "shiny",
  "stormy",
  "zesty",
  "mighty",
  "wobbly",
  "velvet",
  "crimson",
  "golden",
  "silver",
  "electric",
  "frozen",
  "blazing",
  "soggy",
  "chunky",
  "nervous",
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
  "mongoose",
  "capybara",
  "raccoon",
  "walrus",
  "jackal",
  "beaver",
  "gecko",
  "axolotl",
  "wombat",
  "quokka",
  "narwhal",
  "hedgehog",
  "ferret",
  "heron",
  "macaw",
  "bison",
  "coyote",
  "raven",
  "newt",
  "puffin",
  "sloth",
  "toucan",
  "viper",
  "dingo",
  "manatee",
  "caribou",
  "lobster",
  "octopus",
  "squid",
  "cuttlefish",
  "cassowary",
  "blobfish",
] as const;

const PLACEHOLDER_SPICE = [
  "prime",
  "ultra",
  "neo",
  "retro",
  "mega",
  "micro",
  "proto",
  "shadow",
  "ghost",
  "thunder",
  "frost",
  "blaze",
  "nova",
  "echo",
  "pulse",
  "drift",
  "spark",
  "glitch",
  "vortex",
  "shard",
  "omega",
  "alpha",
  "sigma",
  "void",
  "flux",
  "surge",
  "ripple",
  "prism",
  "nexus",
  "zenith",
] as const;

const SPICE_CHANCE_256 = Math.floor((256 * 40) / 100);

function uniform256(): number {
  return randomBytes(1)[0]!;
}

function uniformIntBelow(n: number): number {
  if (n <= 0) {
    throw new Error("n must be positive");
  }
  const limit = 256 - (256 % n);
  let x: number;
  do {
    x = uniform256();
  } while (x >= limit);
  return x % n;
}

function pick<T extends readonly string[]>(arr: T): T[number] {
  return arr[uniformIntBelow(arr.length)]!;
}

function randomHex5(): string {
  return randomBytes(3).toString("hex").slice(0, 5);
}

function maybeSpiceThirdSegment(): string | null {
  if (uniform256() >= SPICE_CHANCE_256) {
    return null;
  }
  return pick(PLACEHOLDER_SPICE);
}

export function randomListenPlaceholderName(): string {
  const a = pick(PLACEHOLDER_FIRST);
  const b = pick(PLACEHOLDER_SECOND);
  const hex = randomHex5();
  const spice = maybeSpiceThirdSegment();
  if (spice) {
    return `${a}-${b}-${spice}-${hex}`;
  }
  return `${a}-${b}-${hex}`;
}

async function promptForwardTo(
  rl: Awaited<ReturnType<typeof createInterface>>,
  current: string | null,
): Promise<string | null> {
  if (current) {
    return current;
  }
  const yn = (await rl.question("Forward to a local URL? [y/N]: ")).trim().toLowerCase();
  if (yn === "y" || yn === "yes") {
    const urlLine = await rl.question(`Local URL [${DEFAULT_FORWARD_URL}]: `);
    return urlLine.trim() || DEFAULT_FORWARD_URL;
  }
  return null;
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
    const forwardTo = await promptForwardTo(rl, options.forwardTo);
    return { displayName, options: { ...options, forwardTo } };
  } finally {
    rl.close();
  }
}

export async function promptGuestListenInteractive(
  options: ListenOptions,
): Promise<{ webhookId: string; options: ListenOptions } | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return null;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const placeholder = randomListenPlaceholderName();
    const idLine = await rl.question(`Webhook ID [${placeholder}]: `);
    const webhookId = idLine.trim() || placeholder;
    const forwardTo = await promptForwardTo(rl, options.forwardTo);
    return { webhookId, options: { ...options, forwardTo } };
  } finally {
    rl.close();
  }
}
