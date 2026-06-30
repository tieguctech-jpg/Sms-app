import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { desc, gte, lte, and, ilike, SQL } from "drizzle-orm";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// GET /api/admin/audit-logs?action=&actor=&from=&to=&page=&limit=
router.get("/", async (req, res) => {
  const { action, actor, from, to, page = "1", limit = "50" } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (action) conditions.push(ilike(auditLogsTable.action, `%${action}%`));
  if (actor) conditions.push(ilike(auditLogsTable.actorEmail, `%${actor}%`));
  if (from) {
    const d = new Date(from as string);
    if (!isNaN(d.getTime())) conditions.push(gte(auditLogsTable.createdAt, d));
  }
  if (to) {
    const d = new Date(to as string);
    if (!isNaN(d.getTime())) conditions.push(lte(auditLogsTable.createdAt, d));
  }

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  res.json({ success: true, logs, page: pageNum, limit: limitNum });
});

export default router;
