export type ListenOptions = {
  verbose: boolean;
  json: boolean;
  forwardTo: string | null;
};

export function parseListenArgv(argv: string[]): { webhookId: string; options: ListenOptions } {
  const options: ListenOptions = {
    verbose: false,
    json: false,
    forwardTo: null,
  };
  let webhookId = "";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") {
      options.verbose = true;
      continue;
    }
    if (a === "--json") {
      options.json = true;
      continue;
    }
    if (a === "--forward-to") {
      const u = argv[++i];
      if (!u?.trim()) {
        throw new Error("--forward-to requires a URL (e.g. http://127.0.0.1:3000/api/webhooks)");
      }
      options.forwardTo = u.trim();
      continue;
    }
    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }
    if (!webhookId) {
      webhookId = a.trim();
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }

  return { webhookId, options };
}
