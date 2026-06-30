import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { eq, ilike, or, desc, count, and, SQL } from "drizzle-orm";
import { audit } from "../../lib/audit";
import { getIp } from "../../lib/auth";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// GET /api/admin/users?search=&role=&page=&limit=
router.get("/", async (req, res) => {
  const { search, role, page = "1", limit = "50" } = req.query;
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.name, `%${search}%`)
      )!
    );
  }
  if (role && ["user", "admin", "super_admin"].includes(role as string)) {
    conditions.push(eq(usersTable.role, role as "user" | "admin" | "super_admin"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [users, totalResult] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        emailVerified: usersTable.emailVerified,
        walletBalance: usersTable.walletBalance,
        isSuspended: usersTable.isSuspended,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(limitNum)
      .offset(offset),
    db.select({ cnt: count() }).from(usersTable).where(whereClause),
  ]);

  res.json({ success: true, users, total: Number(totalResult[0]?.cnt ?? 0), page: pageNum, limit: limitNum });
});

// GET /api/admin/users/:id
router.get("/:id", async (req, res) => {
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.params.id))
    .limit(1);
  if (!user[0]) { res.status(404).json({ success: false, message: "Not found" }); return; }
  const { passwordHash: _ph, ...safe } = user[0];
  res.json({ success: true, user: safe });
});

// PATCH /api/admin/users/:id/role
router.patch("/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body ?? {};
  if (!["user", "admin", "super_admin"].includes(role)) {
    res.status(400).json({ success: false, message: "Invalid role" });
    return;
  }
  const actor = req.user!;
  await db.update(usersTable).set({ role, updatedAt: new Date() }).where(eq(usersTable.id, id));
  await audit({
    actorId: actor.sub,
    actorEmail: actor.email,
    action: "admin.user.role_change",
    targetId: id,
    targetType: "user",
    ipAddress: getIp(req),
    metadata: { newRole: role },
  });
  res.json({ success: true });
});

// PATCH /api/admin/users/:id/suspend
router.patch("/:id/suspend", async (req, res) => {
  const { id } = req.params;
  const { suspended } = req.body ?? {};
  const actor = req.user!;
  await db.update(usersTable).set({ isSuspended: Boolean(suspended), updatedAt: new Date() }).where(eq(usersTable.id, id));
  await audit({
    actorId: actor.sub,
    actorEmail: actor.email,
    action: suspended ? "admin.user.suspend" : "admin.user.unsuspend",
    targetId: id,
    targetType: "user",
    ipAddress: getIp(req),
  });
  res.json({ success: true });
});

// PATCH /api/admin/users/:id/wallet
router.patch("/:id/wallet", async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body ?? {};
  const value = parseFloat(amount);
  if (isNaN(value) || value < 0) {
    res.status(400).json({ success: false, message: "Invalid amount" });
    return;
  }
  const actor = req.user!;
  await db.update(usersTable).set({ walletBalance: String(value), updatedAt: new Date() }).where(eq(usersTable.id, id));
  await audit({
    actorId: actor.sub,
    actorEmail: actor.email,
    action: "admin.user.wallet_adjust",
    targetId: id,
    targetType: "user",
    ipAddress: getIp(req),
    metadata: { amount: value },
  });
  res.json({ success: true });
});

export default router;
