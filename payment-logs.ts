import { Router } from "express";
import { db } from "@workspace/db";
import { paymentLogsTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { desc, eq, and, gte, lte, SQL } from "drizzle-orm";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// GET /api/admin/payment-logs?status=&provider=&from=&to=&page=&limit=
router.get("/", async (req, res) => {
  const { status, provider, from, to, page = "1", limit = "50" } = req.query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (status && ["pending", "successful", "failed", "refunded"].includes(status as string)) {
    conditions.push(eq(paymentLogsTable.status, status as "pending" | "successful" | "failed" | "refunded"));
  }
  if (provider) {
    conditions.push(eq(paymentLogsTable.providerName, provider as string));
  }
  if (from) {
    const fromDate = new Date(from as string);
    if (!isNaN(fromDate.getTime())) conditions.push(gte(paymentLogsTable.createdAt, fromDate));
  }
  if (to) {
    const toDate = new Date(to as string);
    if (!isNaN(toDate.getTime())) conditions.push(lte(paymentLogsTable.createdAt, toDate));
  }

  const logs = await db
    .select()
    .from(paymentLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(paymentLogsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const allForStats = await db
    .select({
      status: paymentLogsTable.status,
      amount: paymentLogsTable.amount,
    })
    .from(paymentLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const stats = {
    total: allForStats.length,
    successful: allForStats.filter((l) => l.status === "successful").length,
    failed: allForStats.filter((l) => l.status === "failed").length,
    pending: allForStats.filter((l) => l.status === "pending").length,
    refunded: allForStats.filter((l) => l.status === "refunded").length,
    revenue: allForStats
      .filter((l) => l.status === "successful")
      .reduce((s, l) => s + parseFloat(l.amount || "0"), 0),
  };

  res.json({ success: true, logs, stats, page: pageNum, limit: limitNum });
});

// PATCH /api/admin/payment-logs/:id — update status (admin override)
router.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body ?? {};

  if (!status || !["pending", "successful", "failed", "refunded"].includes(status)) {
    res.status(400).json({ success: false, message: "Invalid status" });
    return;
  }

  const [log] = await db
    .select({ id: paymentLogsTable.id })
    .from(paymentLogsTable)
    .where(eq(paymentLogsTable.id, id))
    .limit(1);

  if (!log) { res.status(404).json({ success: false, message: "Not found" }); return; }

  await db.update(paymentLogsTable)
    .set({ status: status as "pending" | "successful" | "failed" | "refunded", updatedAt: new Date() })
    .where(eq(paymentLogsTable.id, id));

  res.json({ success: true, message: "Status updated" });
});

export default router;
