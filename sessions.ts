import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable, usersTable, auditLogsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { audit } from "../../lib/audit";
import { getIp } from "../../lib/auth";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// GET /api/admin/sessions — all active sessions across all users
router.get("/", async (req, res) => {
  const sessions = await db
    .select({
      id: sessionsTable.id,
      userId: sessionsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      userRole: usersTable.role,
      deviceType: sessionsTable.deviceType,
      userAgent: sessionsTable.userAgent,
      ipAddress: sessionsTable.ipAddress,
      location: sessionsTable.location,
      isActive: sessionsTable.isActive,
      lastActivity: sessionsTable.lastActivity,
      createdAt: sessionsTable.createdAt,
      revokedAt: sessionsTable.revokedAt,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .orderBy(desc(sessionsTable.lastActivity))
    .limit(200);

  res.json({ success: true, sessions });
});

// GET /api/admin/sessions/active — only active sessions
router.get("/active", async (req, res) => {
  const sessions = await db
    .select({
      id: sessionsTable.id,
      userId: sessionsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      userRole: usersTable.role,
      deviceType: sessionsTable.deviceType,
      ipAddress: sessionsTable.ipAddress,
      location: sessionsTable.location,
      isActive: sessionsTable.isActive,
      lastActivity: sessionsTable.lastActivity,
      createdAt: sessionsTable.createdAt,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.isActive, true))
    .orderBy(desc(sessionsTable.lastActivity));

  res.json({ success: true, sessions });
});

// GET /api/admin/sessions/user/:userId — sessions for a specific user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, userId))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(50);

  res.json({ success: true, sessions });
});

// DELETE /api/admin/sessions/:sessionId — force revoke a session
router.delete("/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const existing = await db
    .select({ id: sessionsTable.id, userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, sessionId))
    .limit(1);

  if (!existing[0]) {
    res.status(404).json({ success: false, message: "Session not found" });
    return;
  }

  await db
    .update(sessionsTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId));

  await audit({
    actorId: req.user!.sub,
    actorEmail: req.user!.email,
    action: "admin.session.revoke",
    targetId: sessionId,
    targetType: "session",
    ipAddress: getIp(req),
    metadata: { targetUserId: existing[0].userId },
  });

  res.json({ success: true, message: "Session revoked" });
});

// DELETE /api/admin/sessions/user/:userId/all — revoke all sessions for a user
router.delete("/user/:userId/all", async (req, res) => {
  const { userId } = req.params;

  await db
    .update(sessionsTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.isActive, true)));

  await audit({
    actorId: req.user!.sub,
    actorEmail: req.user!.email,
    action: "admin.session.revoke_all",
    targetId: userId,
    targetType: "user",
    ipAddress: getIp(req),
  });

  res.json({ success: true, message: "All sessions revoked for user" });
});

// GET /api/admin/sessions/audit — audit log
router.get("/audit", async (req, res) => {
  const logs = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(100);

  res.json({ success: true, logs });
});

export default router;
