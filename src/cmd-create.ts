import { loadCredentials } from "./credentials.js";
import { fetchWithSession } from "./auth-fetch.js";

function parseName(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) {
      return argv[++i].trim();
    }
  }
  return "";
}

export async function cmdCreate(argv: string[]): Promise<void> {
  const cred = await loadCredentials();
  if (!cred) {
    throw new Error("Run eventpipe login first (or set credentials via eventpipe login)");
  }

  const name = parseName(argv);

  const { response } = await fetchWithSession(
    `${cred.baseUrl}/api/account/endpoints`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || undefined }),
    },
    cred,
  );

  const data = (await response.json()) as {
    error?: string;
    webhookId?: string;
    webhookUrl?: string;
    label?: string;
    slugUnavailable?: boolean;
    requestedSlug?: string;
  };
  if (!response.ok) {
    throw new Error(data.error ?? response.statusText);
  }

  if (!data.webhookId || !data.webhookUrl) {
    throw new Error("Unexpected response from API");
  }

  if (data.slugUnavailable && data.requestedSlug) {
    console.log(
      `⚠ Slug "${data.requestedSlug}" is already taken; created with a random id instead.`,
    );
  }

  const labelNote = data.label ? ` (${data.label})` : "";
  console.log(`✓ Endpoint created: ${data.webhookUrl}${labelNote}`);
}
