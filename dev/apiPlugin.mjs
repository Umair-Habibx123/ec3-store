// dev/apiPlugin.mjs
// Vite dev plugin that mounts the Vercel-style /api functions as middleware,
// so `vite` alone serves both the app and the serverless endpoints locally —
// no `vercel dev` / `vercel login` required. Production still uses /api/*.js
// natively on Vercel; this only runs during local dev.
import { loadEnv } from "vite";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(__dirname, "..", "api");

// Map request paths to handler modules.
const routes = {
  "/api/create-checkout-session": path.join(apiDir, "create-checkout-session.js"),
  "/api/stripe-webhook": path.join(apiDir, "stripe-webhook.js"),
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Add the Express/Vercel-style helpers the handlers expect onto a Node res.
function decorateRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    res.end(typeof body === "string" ? body : JSON.stringify(body));
    return res;
  };
  return res;
}

export default function devApiPlugin() {
  return {
    name: "dev-api-plugin",
    apply: "serve", // dev only
    config(_, { mode }) {
      // Expose .env vars (incl. non-VITE_ ones) to the handlers via process.env.
      const env = loadEnv(mode, process.cwd(), "");
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const handlerPath = routes[url.pathname];
        if (!handlerPath) return next();

        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const handler = mod.default;
          const bodyParser = mod.config?.api?.bodyParser;

          // Parse JSON body unless the handler opts out (e.g. the webhook).
          if (bodyParser !== false && req.method !== "GET") {
            const raw = await readRawBody(req);
            const ct = req.headers["content-type"] || "";
            req.body = ct.includes("application/json") && raw.length
              ? JSON.parse(raw.toString("utf8"))
              : raw.toString("utf8");
          }

          req.query = Object.fromEntries(url.searchParams);
          decorateRes(res);
          await handler(req, res);
        } catch (err) {
          console.error(`[dev-api] ${url.pathname} error:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Dev API handler failed" }));
          }
        }
      });
    },
  };
}
