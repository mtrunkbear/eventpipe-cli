import { loadCredentials, type StoredCredentials } from "./credentials.js";
import { fetchWithSession } from "./auth-fetch.js";

export type CreatedEndpoint = {
  webhookId: string;
  webhookUrl: string;
  label?: string;
  slugUnavailable?: boolean;
  requestedSlug?: string;
};

export type CreateEndpointResult = {
  endpoint: CreatedEndpoint;
  credentials: StoredCredentials;
};

function parseName(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) {
      return argv[++i]!.trim();
    }
  }
  return "";
}

function throwApiError(response: Response, data: { error?: string }): never {
  const msg = data.error ?? response.statusText;
  if (response.status === 401) {
    throw new Error(
      `Not authenticated (${msg}). Run: eventpipe login — or remove ~/.eventpipe/credentials.json to use guest listen without an account.`,
    );
  }
  throw new Error(msg);
}

export async function createEndpoint(
  cred: StoredCredentials,
  name: string | undefined,
): Promise<CreateEndpointResult> {
  const { response, credentials } = await fetchWithSession(
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
    throwApiError(response, data);
  }

  if (!data.webhookId || !data.webhookUrl) {
    throw new Error("Unexpected response from API");
  }

  return {
    credentials,
    endpoint: {
      webhookId: data.webhookId,
      webhookUrl: data.webhookUrl,
      label: data.label,
      slugUnavailable: data.slugUnavailable,
      requestedSlug: data.requestedSlug,
    },
  };
}

export async function cmdCreate(argv: string[]): Promise<void> {
  const cred = await loadCredentials();
  if (!cred) {
    throw new Error("Run eventpipe login first (or set credentials via eventpipe login)");
  }

  const name = parseName(argv);
  const { endpoint: data } = await createEndpoint(cred, name || undefined);

  if (data.slugUnavailable && data.requestedSlug) {
    console.log(
      `\u26A0 Slug "${data.requestedSlug}" is already taken; created with a random id instead.`,
    );
  }

  const labelNote = data.label ? ` (${data.label})` : "";
  console.log(`\u2713 Endpoint created: ${data.webhookUrl}${labelNote}`);
}
