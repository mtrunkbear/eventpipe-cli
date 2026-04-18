import WebSocket from "ws";
import { forwardWebhookToLocal, type FlowEventWire } from "./forward-local.js";
import { loadCredentials } from "./credentials.js";
import { fetchWithSession } from "./auth-fetch.js";
import type { ListenOptions } from "./listen-args.js";
import { resolveEventpipeBaseUrl } from "./base-url.js";
import {
  clearGuestListenSession,
  loadGuestListenSession,
  saveGuestListenSession,
} from "./guest-listen-session.js";
import { createEndpoint } from "./cmd-create.js";
import { printGuestListenEnd, printGuestListenIntro, printGuestListenMilestone, printWebhookEvent } from "./cli-style.js";
import { promptGuestListenInteractive, promptListenInteractive } from "./listen-interactive.js";

const GUEST_DEFAULT_MAX_EVENTS = 25;
const GUEST_DEFAULT_SESSION_MIN = 15;


type GuestStreamOpts = {
  maxEvents: number;
  sessionMs: number;
  onSessionEnd: (reason: "events" | "time") => void;
};

async function connectRelayAndStream(
  wid: string,
  wsUrl: string,
  token: string,
  options: ListenOptions,
  guest: GuestStreamOpts | null,
): Promise<void> {
  let eventCount = 0;
  const deadline = guest ? Date.now() + guest.sessionMs : null;
  let guestInterval: ReturnType<typeof setInterval> | null = null;

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

    if (guest && deadline) {
      guestInterval = setInterval(() => {
        if (Date.now() >= deadline) {
          guest.onSessionEnd("time");
          if (guestInterval) {
            clearInterval(guestInterval);
            guestInterval = null;
          }
          shutdown();
        }
      }, 1_000);
    }

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "auth", token }));
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

          if (guest) {
            eventCount += 1;
          }

          const summary = msg.summary ?? "webhook";
          const bytes = typeof msg.bytes === "number" ? msg.bytes : 0;
          const event = (msg.event ?? {}) as FlowEventWire;

          if (options.json) {
            console.log(JSON.stringify({ summary, bytes, event }));
          } else {
            printWebhookEvent({ bytes, event });
            if (options.verbose) {
              console.log(JSON.stringify(event, null, 2));
            }
          }

          if (options.forwardTo) {
            const r = await forwardWebhookToLocal(options.forwardTo, event);
            if (r.error) {
              console.error(`\u21AA forward failed: ${r.error}`);
            } else {
              console.error(`\u21AA forwarded (${r.status})`);
            }
          }

          if (guest) {
            if (eventCount === 5 || eventCount === 15 || eventCount === guest.maxEvents - 1) {
              printGuestListenMilestone(eventCount, guest.maxEvents);
            }
            if (eventCount >= guest.maxEvents) {
              guest.onSessionEnd("events");
              if (guestInterval) {
                clearInterval(guestInterval);
                guestInterval = null;
              }
              shutdown();
            }
          }
        } catch {
          /* ignore */
        }
      })();
    });

    ws.on("close", () => {
      if (guestInterval) {
        clearInterval(guestInterval);
      }
      resolve();
    });
    ws.on("error", (e) => {
      if (guestInterval) {
        clearInterval(guestInterval);
      }
      reject(e);
    });
  });
}

export async function cmdListen(webhookIdArg: string, options: ListenOptions): Promise<void> {
  let cred = await loadCredentials();
  if (cred) {
    let wid = webhookIdArg.trim();
    let opts = options;

    if (!wid) {
      const interactive = await promptListenInteractive(options);
      opts = interactive.options;
      const { endpoint: created, credentials: credAfterCreate } = await createEndpoint(
        cred,
        interactive.displayName,
      );
      cred = credAfterCreate;
      wid = created.webhookId;
      if (created.slugUnavailable && created.requestedSlug) {
        console.log(
          `\u26A0 Slug "${created.requestedSlug}" is already taken; created with a random id instead.`,
        );
      }
      console.log(`${created.webhookUrl}\n`);
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
      const msg = data.error ?? response.statusText;
      if (response.status === 401) {
        throw new Error(
          `Not authenticated (${msg}). Run: eventpipe login — or remove ~/.eventpipe/credentials.json for guest listen.`,
        );
      }
      throw new Error(msg);
    }

    if (!data.token || !data.relayWsUrl) {
      throw new Error(
        data.error ?? "listen-token misconfigured on server (EVENTPIPE_RELAY_WS_URL / EVENTPIPE_LISTEN_JWT_SECRET)",
      );
    }

    console.log(`\u{1F50C} Connected to ${wid}`);
    if (opts.forwardTo) {
      console.error(`\u21AA forwarding to ${opts.forwardTo}`);
    }

    await connectRelayAndStream(wid, data.relayWsUrl, data.token, opts, null);
    return;
  }

  await cmdListenGuest(webhookIdArg, options);
}

async function cmdListenGuest(webhookIdArg: string, options: ListenOptions): Promise<void> {
  const base = resolveEventpipeBaseUrl();
  let trimmedArg = webhookIdArg.trim();
  let opts = options;
  const session = await loadGuestListenSession(base);

  if (!trimmedArg && !session) {
    const prompted = await promptGuestListenInteractive(options);
    if (prompted) {
      trimmedArg = prompted.webhookId;
      opts = prompted.options;
    }
  }

  const body: { webhookId?: string; guestCliToken?: string } = {};
  if (trimmedArg) {
    body.webhookId = trimmedArg;
    if (session?.webhookId === trimmedArg) {
      body.guestCliToken = session.guestCliToken;
    }
  } else if (session) {
    body.webhookId = session.webhookId;
    body.guestCliToken = session.guestCliToken;
  }

  const res = await fetch(`${base}/api/cli/guest-listen-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    error?: string;
    token?: string;
    relayWsUrl?: string;
    webhookId?: string;
    webhookUrl?: string;
    guestCliToken?: string;
    guestMaxEvents?: number;
    guestSessionMinutes?: number;
  };

  if (!res.ok) {
    throw new Error(data.error ?? res.statusText);
  }

  if (!data.token || !data.relayWsUrl || !data.webhookId || !data.webhookUrl) {
    throw new Error(data.error ?? "guest-listen-token misconfigured on server");
  }

  const guestCliToken = data.guestCliToken ?? session?.guestCliToken;
  if (!guestCliToken) {
    throw new Error("Server did not return guestCliToken");
  }

  await saveGuestListenSession({
    baseUrl: base,
    webhookId: data.webhookId,
    guestCliToken,
  });

  const maxEvents = data.guestMaxEvents ?? GUEST_DEFAULT_MAX_EVENTS;
  const sessionMin = data.guestSessionMinutes ?? GUEST_DEFAULT_SESSION_MIN;

  printGuestListenIntro(data.webhookUrl, maxEvents, sessionMin);

  console.log(`\u{1F50C} Listening on ${data.webhookId}`);
  if (opts.forwardTo) {
    console.error(`\u21AA forwarding to ${opts.forwardTo}`);
  }

  let endReason: "events" | "time" | null = null;

  await connectRelayAndStream(data.webhookId, data.relayWsUrl, data.token, opts, {
    maxEvents,
    sessionMs: sessionMin * 60_000,
    onSessionEnd: (r) => {
      endReason = r;
    },
  });

  if (endReason) {
    printGuestListenEnd(endReason);
    await clearGuestListenSession();
  }
}
