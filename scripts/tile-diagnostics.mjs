/** Loopback-only synthetic tile endpoint for native header/cache checks.
 * Never proxies OSM or records device location. Use /fresh or /stale prefixes.
 * Expected: fresh revisit has no request; stale revisit sends If-None-Match.
 */
import http from "node:http";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
const server = http.createServer((req, res) => {
  const etag = '"spc-synthetic-tile-v1"';
  const status = req.headers["if-none-match"] === etag ? 304 : 200;
  const maxAge = req.url?.startsWith("/fresh/") ? 3600 : 0;
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      path: req.url,
      userAgent: req.headers["user-agent"],
      ifNoneMatch: req.headers["if-none-match"] ?? null,
      status,
      maxAge,
    }),
  );
  res.writeHead(status, {
    "Content-Type": "image/png",
    "Cache-Control": `max-age=${maxAge}`,
    ETag: etag,
  });
  res.end(status === 304 ? undefined : png);
});
server.listen(8123, "127.0.0.1", () =>
  console.log("Synthetic tile diagnostics listening on 127.0.0.1:8123"),
);
