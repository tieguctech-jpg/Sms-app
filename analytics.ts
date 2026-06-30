import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  sessionsTable,
  paymentLogsTable,
  supportTicketsTable,
  appRatingsTable,
} from "@workspace/db/schema";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { count, sum, eq, and, gte, avg, sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// GET /api/admin/analytics/overview
router.get("/overview", async (_req, res) => {
  const [totalUsersResult, activeSessionsResult, paymentStats, ratingStats] =
    await Promise.all([
      db.select({ cnt: count() }).from(usersTable),
      db
        .select({ cnt: count() })
        .from(sessionsTable)
        .where(eq(sessionsTable.isActive, true)),
      db
        .select({ status: paymentLogsTable.status, cnt: count(), total: sum(paymentLogsTable.amount) })
        .from(paymentLogsTable)
        .groupBy(paymentLogsTable.status),
      db.select({ avgStars: avg(appRatingsTable.stars), total: count() }).from(appRatingsTable),
    ]);

  const pMap: Record<string, { count: number; revenue: number }> = {};
  for (const p of paymentStats) {
    pMap[p.status] = { count: Number(p.cnt), revenue: parseFloat(p.total ?? "0") };
  }

  res.json({
    success: true,
    data: {
      totalUsers: Number(totalUsersResult[0]?.cnt ?? 0),
      activeSessions: Number(activeSessionsResult[0]?.cnt ?? 0),
      successfulPayments: pMap["successful"]?.count ?? 0,
      failedPayments: pMap["failed"]?.count ?? 0,
      pendingPayments: pMap["pending"]?.count ?? 0,
      refundedPayments: pMap["refunded"]?.count ?? 0,
      totalRevenue: pMap["successful"]?.revenue ?? 0,
      averageRating: ratingStats[0]?.avgStars ?? "0",
      totalRatings: Number(ratingStats[0]?.total ?? 0),
    },
  });
});

// GET /api/admin/analytics/revenue/daily?from=&to=
router.get("/revenue/daily", async (req, res) => {
  const { from } = req.query;
  const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 86400000);

  const rows = await db
    .select({
      day: sql<string>`date_trunc('day', ${paymentLogsTable.createdAt})::date::text`,
      revenue: sum(paymentLogsTable.amount),
      count: count(),
    })
    .from(paymentLogsTable)
    .where(and(eq(paymentLogsTable.status, "successful"), gte(paymentLogsTable.createdAt, fromDate)))
    .groupBy(sql`date_trunc('day', ${paymentLogsTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${paymentLogsTable.createdAt})`);

  res.json({ success: true, data: rows });
});

// GET /api/admin/analytics/revenue/monthly
router.get("/revenue/monthly", async (_req, res) => {
  const rows = await db
    .select({
      month: sql<string>`date_trunc('month', ${paymentLogsTable.createdAt})::date::text`,
      revenue: sum(paymentLogsTable.amount),
      count: count(),
    })
    .from(paymentLogsTable)
    .where(eq(paymentLogsTable.status, "successful"))
    .groupBy(sql`date_trunc('month', ${paymentLogsTable.createdAt})`)
    .orderBy(sql`date_trunc('month', ${paymentLogsTable.createdAt})`)
    .limit(12);

  res.json({ success: true, data: rows });
});

// GET /api/admin/analytics/users/growth
router.get("/users/growth", async (_req, res) => {
  const rows = await db
    .select({
      day: sql<string>`date_trunc('day', ${usersTable.createdAt})::date::text`,
      count: count(),
    })
    .from(usersTable)
    .groupBy(sql`date_trunc('day', ${usersTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${usersTable.createdAt})`)
    .limit(30);

  res.json({ success: true, data: rows });
});

// GET /api/admin/analytics/payments/providers
router.get("/payments/providers", async (_req, res) => {
  const rows = await db
    .select({
      provider: paymentLogsTable.providerName,
      status: paymentLogsTable.status,
      cnt: count(),
      total: sum(paymentLogsTable.amount),
    })
    .from(paymentLogsTable)
    .groupBy(paymentLogsTable.providerName, paymentLogsTable.status);

  const providerMap: Record<string, { name: string; successful: number; failed: number; revenue: number }> = {};
  for (const r of rows) {
    if (!providerMap[r.provider]) {
      providerMap[r.provider] = { name: r.provider, successful: 0, failed: 0, revenue: 0 };
    }
    if (r.status === "successful") {
      providerMap[r.provider].successful = Number(r.cnt);
      providerMap[r.provider].revenue = parseFloat(r.total ?? "0");
    } else if (r.status === "failed") {
      providerMap[r.provider].failed = Number(r.cnt);
    }
  }

  res.json({ success: true, data: Object.values(providerMap) });
});

export default router;
