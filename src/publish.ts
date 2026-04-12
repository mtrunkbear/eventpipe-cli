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

export async function publishVersion(params: {
  cred: StoredCredentials;
  pipelineId: string;
  manifest: EventpipeManifest;
  bundles: Array<{
    nodeId: string;
    bundleCode: string;
    bundleHash: string;
  }>;
  sourceCode?: string | null;
}): Promise<PublishResult> {
  const baseUrl = params.cred.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/account/pipelines/${params.pipelineId}/versions`;
  const body = JSON.stringify({
    sourceCode: params.sourceCode ?? null,
    buildMeta: {
      bundler: "eventpipe-cli",
      generatedAt: new Date().toISOString(),
    },
    settings: params.manifest.settings,
    codeBundles: params.bundles,
  });

  const { response: res } = await fetchWithSession(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    },
    params.cred,
  );

  const data = (await res.json()) as PublishResult & { error?: string };
  if (!res.ok) {
    return { error: data?.error ?? res.statusText };
  }
  return data;
}
