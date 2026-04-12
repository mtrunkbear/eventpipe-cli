export type FlowEventWire = {
  webhookId?: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  path?: string;
  body?: unknown;
  receivedAt?: number;
};

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "upgrade",
]);

export async function forwardWebhookToLocal(
  forwardTo: string,
  event: FlowEventWire,
): Promise<{ ok: boolean; status: number; error?: string }> {
  let url: URL;
  try {
    url = new URL(forwardTo);
  } catch {
    return { ok: false, status: 0, error: "Invalid --forward-to URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, status: 0, error: "Only http(s) URLs are allowed for --forward-to" };
  }

  const q = event.query ?? {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) {
      continue;
    }
    if (Array.isArray(v)) {
      for (const item of v) {
        url.searchParams.append(k, String(item));
      }
    } else {
      url.searchParams.append(k, String(v));
    }
  }

  const method = (event.method ?? "POST").toUpperCase();
  const headers = new Headers();
  const raw = event.headers ?? {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") {
      continue;
    }
    const key = k.toLowerCase();
    if (HOP_BY_HOP.has(key)) {
      continue;
    }
    headers.set(k, v);
  }

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const b = event.body;
    if (b !== undefined && b !== null) {
      if (typeof b === "string") {
        body = b;
      } else if (typeof b === "object") {
        body = JSON.stringify(b);
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json; charset=utf-8");
        }
      } else {
        body = String(b);
      }
    }
  }

  try {
    const res = await fetch(url, { method, headers, body, redirect: "manual" });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, error: message };
  }
}
