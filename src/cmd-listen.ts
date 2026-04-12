import WebSocket from "ws";
import { forwardWebhookToLocal, type FlowEventWire } from "./forward-local.js";
import { loadCredentials } from "./credentials.js";
import { fetchWithSession } from "./auth-fetch.js";
import type { ListenOptions } from "./listen-args.js";

function formatKb(bytes: number): string {
  return (bytes / 1024).toFixed(1);
}

export async function cmdListen(webhookId: string, options: ListenOptions): Promise<void> {
  const wid = webhookId.trim();
  if (!wid) {
    throw new Error("webhook id is required");
  }

  const cred = await loadCredentials();
  if (!cred) {
    throw new Error("Run eventpipe login first");
  }

  const { response } = await fetchWithSession(
    `${cred.baseUrl}/api/cli/listen-token`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ webhookId: wid }),
    },
    cred,
  );

  const data = (await response.json()) as {
    error?: string;
    token?: string;
    relayWsUrl?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? response.statusText);
  }

  if (!data.token || !data.relayWsUrl) {
    throw new Error(data.error ?? "listen-token misconfigured on server (EVENTPIPE_RELAY_WS_URL / EVENTPIPE_LISTEN_JWT_SECRET)");
  }

  const wsUrl = data.relayWsUrl;
  console.log(`🔌 Conectado a ${wid}`);
  if (options.forwardTo) {
    console.error(`↪ forwarding to ${options.forwardTo}`);
  }

  const ws = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    const shutdown = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "auth", token: data.token }));
    });

    ws.on("message", (buf) => {
      void (async () => {
        try {
          const msg = JSON.parse(buf.toString()) as {
            type?: string;
            webhookId?: string;
            summary?: string;
            bytes?: number;
            event?: unknown;
          };
          if (msg.type === "ready") {
            return;
          }
          if (msg.type !== "webhook") {
            return;
          }

          const summary = msg.summary ?? "webhook";
          const bytes = typeof msg.bytes === "number" ? msg.bytes : 0;
          const event = (msg.event ?? {}) as FlowEventWire;

          if (options.json) {
            console.log(JSON.stringify({ summary, bytes, event }));
          } else {
            console.log(`📩 ${summary} (${formatKb(bytes)}KB)`);
            if (options.verbose) {
              console.log(JSON.stringify(event, null, 2));
            }
          }

          if (options.forwardTo) {
            const r = await forwardWebhookToLocal(options.forwardTo, event);
            if (r.error) {
              console.error(`↪ forward failed: ${r.error}`);
            } else {
              console.error(`↪ forwarded (${r.status})`);
            }
          }
        } catch {
          /* ignore */
        }
      })();
    });

    ws.on("close", () => resolve());
    ws.on("error", (e) => reject(e));
  });
}
