/**
 * ATRIUM HRIS app shell — Vite UI + Express proxy to Wolf API /v1/hr/*
 */
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import {
  clearHrSessionCookie,
  exchangeHandoffToken,
  getHrSession,
  requireHrAppSession,
  setHrSessionCookie,
  wolfApiOriginExport,
  type HrSession,
} from "./server/wolfAuth.js";

dotenv.config();

const PORT = Number(process.env.PORT) || 3200;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function session(req: express.Request): HrSession {
  return (req as express.Request & { hrSession: HrSession }).hrSession;
}

async function proxyHr(
  req: express.Request,
  res: express.Response,
  apiPath: string,
  init?: RequestInit,
) {
  const s = session(req);
  const url = `${wolfApiOriginExport()}${apiPath}`;
  const upstream = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-wolf-session-id": s.wolfSessionId,
      "x-wolf-company-id": s.companyId,
      ...(init?.headers ?? {}),
    },
  });
  const text = await upstream.text();
  res.status(upstream.status);
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("content-type", ct);
  res.send(text);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(requireHrAppSession);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "wolf-hr-app" });
  });

  app.post("/api/wolf/handoff", async (req, res) => {
    try {
      const token = String(req.body?.token ?? "");
      if (!token) {
        res.status(400).json({ error: "token_required" });
        return;
      }
      const s = await exchangeHandoffToken(token);
      setHrSessionCookie(res, s.id);
      res.json({
        userId: s.userId,
        companyId: s.companyId,
        authLevel: s.authLevel,
      });
    } catch (err) {
      res.status(401).json({
        error: "handoff_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get("/api/wolf/session", (req, res) => {
    const s = getHrSession(req);
    if (!s) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    res.json({ userId: s.userId, companyId: s.companyId, authLevel: s.authLevel });
  });

  app.post("/api/wolf/logout", (req, res) => {
    const s = getHrSession(req);
    if (s) {
      /* session map GC not critical for local */
    }
    clearHrSessionCookie(res);
    res.json({ ok: true });
  });

  app.all("/api/hr/*", async (req, res) => {
    const suffix = req.path.replace(/^\/api\/hr/, "/v1/hr");
    const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    try {
      await proxyHr(req, res, `${suffix}${qs}`, {
        method: req.method,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body ?? {}),
      });
    } catch (err) {
      res.status(502).json({
        error: "upstream_failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Catch handoff token in query on first load
  app.get("/boot", async (req, res) => {
    const token = String(req.query.wolf_token ?? "");
    if (token) {
      try {
        const s = await exchangeHandoffToken(token);
        setHrSessionCookie(res, s.id);
      } catch {
        /* fall through */
      }
    }
    res.redirect("/");
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      try {
        let token = String(req.query.wolf_token ?? "");
        if (token) {
          try {
            const s = await exchangeHandoffToken(token);
            setHrSessionCookie(res, s.id);
          } catch {
            /* ignore */
          }
        }
        const url = req.originalUrl;
        let template = await vite.transformIndexHtml(
          url,
          await (await import("node:fs/promises")).readFile(
            path.join(__dirname, "index.html"),
            "utf-8",
          ),
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const dist = path.join(__dirname, "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Wolf HR listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
