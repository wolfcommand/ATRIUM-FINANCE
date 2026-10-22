import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { handoffRouter } from "./routes/handoff.js";
import { accessRouter } from "./routes/access.js";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: process.env.WOLF_CORS_ORIGIN?.split(",") ?? [
        "http://localhost:3100",
        "http://127.0.0.1:3100",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "wolf-api" });
  });

  const auth = authRouter();
  app.use("/v1/auth", auth);
  // Playbook: GET /v1/me (same handlers; /me is defined on the router)
  app.use("/v1", auth);
  app.use(handoffRouter());
  app.use(accessRouter());

  return app;
}
