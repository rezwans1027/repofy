import { createServer } from "node:http";
import { DISABLED_CLIENT_CAPABILITIES } from "@repofy/contracts";

// Only simulates auth/capability reads for UI routing tests, never a repository/report response.
createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method === "GET" && request.url === "/api/v1/capabilities") {
    response.end(JSON.stringify({ success: true, data: DISABLED_CLIENT_CAPABILITIES }));
  } else if (request.method === "GET" && request.url === "/api/auth/me") {
    response.end(JSON.stringify({ success: true, data: { user: null } }));
  } else {
    response.statusCode = 404;
    response.end(JSON.stringify({ success: false, error: "Not found" }));
  }
}).listen(3191, "127.0.0.1");
