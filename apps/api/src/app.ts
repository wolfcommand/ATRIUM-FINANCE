import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { handoffRouter } from "./routes/handoff.js";
import { accessRouter } from "./routes/access.js";
import { eventsRouter } from "./routes/events.js";
import { adminRouter } from "./routes/admin.js";
import { hrRouter } from "./routes/hr.js";
import { academyRouter } from "./routes/academy.js";
import { approvalsRouter } from "./routes/approvals.js";
import { contentRouter } from "./routes/content.js";
import { registerFinanceEmployeeRefConsumer } from "./modules/finance/employeeRefConsumer.js";
import { registerAcademyOnboardingConsumer } from "./modules/academy/onboardingConsumer.js";
import { resetOutboxHandlersForTests } from "./modules/integration/outbox.js";
import { resetEmployeeRefConsumerForTests } from "./modules/finance/employeeRefConsumer.js";

let consumersRegistered = false;

export function createApp(opts?: { registerConsumers?: boolean }) {
  const app = express();
  app.use(
    cors({
      origin: process.env.WOLF_CORS_ORIGIN?.split(",") ?? [
        "http://localhost:3100",
        "http://127.0.0.1:3100",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3200",
        "http://127.0.0.1:3200",
      ],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "wolf-api" });
  });

  const auth = authRouter();
  app.use("/v1/auth", auth);
  // Playbook: GET /v1/me (same handlers; /me is defined on the router)
  app.use("/v1", auth);
  app.use(handoffRouter());
  app.use(accessRouter());
  app.use(eventsRouter());
  app.use(adminRouter());
  app.use(hrRouter());
  app.use(academyRouter());
  app.use(approvalsRouter());
  app.use(contentRouter());

  if (opts?.registerConsumers !== false && !consumersRegistered) {
    registerFinanceEmployeeRefConsumer();
    registerAcademyOnboardingConsumer();
    consumersRegistered = true;
  }

  return app;
}

/** Test helper: reset bus handlers so createApp can re-register cleanly. */
export function resetEventConsumersForTests(): void {
  resetOutboxHandlersForTests();
  resetEmployeeRefConsumerForTests();
  consumersRegistered = false;
}
