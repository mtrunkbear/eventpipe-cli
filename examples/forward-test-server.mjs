import { createServer } from "node:http";

const PORT = 4242;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname !== "/webhook") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found. Use POST /webhook");
    return;
  }

  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    const ts = new Date().toISOString();
    console.log(`\n--- ${ts} ${req.method} /webhook ---`);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", raw || "(empty)");

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, receivedAt: ts }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Forward test server http://127.0.0.1:${PORT}/webhook (listening)`);
});
