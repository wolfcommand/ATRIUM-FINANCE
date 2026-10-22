import { Router } from "express";
import { z } from "zod";
import {
  getAcademyAuth,
  requireAcademyPermission,
  requireAcademySession,
} from "../modules/academy/sessionAuth.js";
import { ensureSeedCourses, getCourse, listPublishedCourses } from "../modules/academy/courses.js";
import { listMyEnrollments, updateProgress } from "../modules/academy/enrollments.js";

export function academyRouter(): Router {
  const router = Router();
  router.use("/v1/academy", requireAcademySession);

  router.get(
    "/v1/academy/courses",
    requireAcademyPermission("academy.course.read"),
    (_req, res) => {
      ensureSeedCourses();
      res.json({ courses: listPublishedCourses() });
    },
  );

  router.get(
    "/v1/academy/courses/:id",
    requireAcademyPermission("academy.course.read"),
    (req, res) => {
      const course = getCourse(req.params.id);
      if (!course) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ course });
    },
  );

  router.get(
    "/v1/academy/enrollments",
    requireAcademyPermission("academy.enrollment.read"),
    (req, res) => {
      const auth = getAcademyAuth(req);
      res.json({ enrollments: listMyEnrollments(auth.userId, auth.companyId) });
    },
  );

  router.post(
    "/v1/academy/enrollments/:id/progress",
    requireAcademyPermission("academy.progress.write"),
    (req, res) => {
      const auth = getAcademyAuth(req);
      const parsed = z
        .object({
          percent: z.number().min(0).max(100),
          lastPosition: z.string().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      try {
        const result = updateProgress({
          enrollmentId: req.params.id,
          userId: auth.userId,
          percent: parsed.data.percent,
          lastPosition: parsed.data.lastPosition,
        });
        res.json(result);
      } catch (err) {
        res.status(404).json({ error: err instanceof Error ? err.message : "not_found" });
      }
    },
  );

  return router;
}
