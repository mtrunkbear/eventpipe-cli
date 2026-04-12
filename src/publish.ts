import type { EventpipeManifest } from "./config.js";

export type PublishResult = {
  success?: boolean;
  version?: number;
  bundleHash?: string;
  bundleSizeBytes?: number;
  error?: string;
};

export async function publishVersion(params: {
  baseUrl: string;
  apiKey: string;
  pipelineId: string;
  manifest: EventpipeManifest;
  bundles: Array<{
    nodeId: string;
    bundleCode: string;
    bundleHash: string;
  }>;
  sourceCode?: string | null;
}): Promise<PublishResult> {
  const res = await fetch(`${params.baseUrl}/api/account/pipelines/${params.pipelineId}/versions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": params.apiKey,
    },
    body: JSON.stringify({
      sourceCode: params.sourceCode ?? null,
      buildMeta: {
        bundler: "eventpipe-cli",
        generatedAt: new Date().toISOString(),
      },
      settings: params.manifest.settings,
      codeBundles: params.bundles,
    }),
  });

  const data = (await res.json()) as PublishResult & { error?: string };
  if (!res.ok) {
    return { error: data?.error ?? res.statusText };
  }
  return data;
}
