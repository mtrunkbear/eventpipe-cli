import type { EventpipeManifest } from "./config.js";
import { fetchWithSession } from "./auth-fetch.js";
import type { StoredCredentials } from "./credentials.js";

export type PublishResult = {
  success?: boolean;
  version?: number;
  bundleHash?: string;
  bundleSizeBytes?: number;
  error?: string;
};

export type PublishAuth =
  | { type: "apiKey"; apiKey: string }
  | { type: "session"; cred: StoredCredentials };

export async function publishVersion(params: {
  baseUrl: string;
  auth: PublishAuth;
  pipelineId: string;
  manifest: EventpipeManifest;
  bundles: Array<{
    nodeId: string;
    bundleCode: string;
    bundleHash: string;
  }>;
  sourceCode?: string | null;
}): Promise<PublishResult> {
  const url = `${params.baseUrl}/api/account/pipelines/${params.pipelineId}/versions`;
  const body = JSON.stringify({
    sourceCode: params.sourceCode ?? null,
    buildMeta: {
      bundler: "eventpipe-cli",
      generatedAt: new Date().toISOString(),
    },
    settings: params.manifest.settings,
    codeBundles: params.bundles,
  });

  let res: Response;
  if (params.auth.type === "apiKey") {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": params.auth.apiKey,
      },
      body,
    });
  } else {
    const out = await fetchWithSession(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      },
      params.auth.cred,
    );
    res = out.response;
  }

  const data = (await res.json()) as PublishResult & { error?: string };
  if (!res.ok) {
    return { error: data?.error ?? res.statusText };
  }
  return data;
}
