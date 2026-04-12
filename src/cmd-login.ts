import { exec } from "node:child_process";
import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { saveCredentials, type StoredCredentials } from "./credentials.js";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function openBrowser(url: string): void {
  const safe = url.replace(/"/g, '\\"');
  const cmd =
    process.platform === "darwin"
      ? `open "${safe}"`
      : process.platform === "win32"
        ? `cmd /c start "" "${safe}"`
        : `xdg-open "${safe}"`;
  exec(cmd, () => {});
}

export async function cmdLogin(): Promise<void> {
  const base = process.env.EVENTPIPE_BASE_URL?.replace(/\/$/, "").trim();
  if (!base) {
    throw new Error("EVENTPIPE_BASE_URL is required (e.g. https://app.example.com)");
  }

  const port = randomInt(47_890, 48_000);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      fn();
    };

    const server = createServer((req, res) => {
      const u = req.url ?? "";

      if (req.method === "OPTIONS" && u.startsWith("/callback")) {
        res.writeHead(204, cors);
        res.end();
        return;
      }

      if (req.method === "POST" && u.startsWith("/callback")) {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
          void (async () => {
            try {
              const raw = Buffer.concat(chunks).toString("utf8");
              const data = JSON.parse(raw) as {
                access_token?: string;
                refresh_token?: string;
                base_url?: string;
              };
              if (!data.access_token || !data.refresh_token) {
                res.writeHead(400, { "content-type": "application/json", ...cors });
                res.end(JSON.stringify({ error: "missing tokens" }));
                done(() => reject(new Error("Missing tokens in callback")));
                server.close();
                return;
              }
              const stored: StoredCredentials = {
                baseUrl: (data.base_url ?? base).replace(/\/$/, ""),
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
              };
              await saveCredentials(stored);
              res.writeHead(200, { "content-type": "application/json", ...cors });
              res.end(JSON.stringify({ ok: true }));
              server.close(() => done(() => resolve()));
            } catch {
              res.writeHead(400, { ...cors });
              res.end();
              done(() => reject(new Error("Invalid callback body")));
              server.close();
            }
          })();
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.on("error", (e) => done(() => reject(e)));

    server.listen(port, "127.0.0.1", () => {
      const authorizeUrl = `${base}/cli/authorize?port=${port}`;
      console.log("Opening browser to sign in…");
      console.log(authorizeUrl);
      openBrowser(authorizeUrl);
    });

    const timer = setTimeout(() => {
      server.close();
      done(() => reject(new Error("Login timed out (2 min)")));
    }, 120_000);
    server.on("close", () => clearTimeout(timer));
  });

  console.log("Saved credentials to ~/.eventpipe/credentials.json");
}
