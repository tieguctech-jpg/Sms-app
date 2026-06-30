import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, and, desc } from "drizzle-orm";
import { hashPassword, verifyPassword, getIp } from "../lib/auth";
import { audit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

// POST /api/security/change-password
router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    return;
  }
  const user = req.user!;
  const users = await db
    .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, user.sub))
    .limit(1);

  if (!users[0]) { res.status(404).json({ success: false, message: "User not found" }); return; }
  const valid = await verifyPassword(currentPassword, users[0].passwordHash);
  if (!valid) { res.status(401).json({ success: false, message: "Current password is incorrect" }); return; }

  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(usersTable.id, user.sub));
  await audit({ actorId: user.sub, actorEmail: user.email, action: "auth.change_password", ipAddress: getIp(req) });
  res.json({ success: true });
});

// GET /api/security/login-history
router.get("/login-history", async (req, res) => {
  const user = req.user!;
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, user.sub))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(20);
  res.json({ success: true, sessions });
});

// DELETE /api/security/sessions/:id — revoke a specific session
router.delete("/sessions/:id", async (req, res) => {
  const user = req.user!;
  const session = await db
    .select({ id: sessionsTable.id, userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.id, req.params.id))
    .limit(1);
  if (!session[0] || session[0].userId !== user.sub) {
    res.status(404).json({ success: false, message: "Session not found" });
    return;
  }
  await db.update(sessionsTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(sessionsTable.id, req.params.id));
  res.json({ success: true });
});

// DELETE /api/security/sessions — revoke all OTHER sessions (keep current)
router.delete("/sessions", async (req, res) => {
  const user = req.user!;
  const currentJti = user.jti;
  const allSessions = await db
    .select({ id: sessionsTable.id, token: sessionsTable.token })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.sub), eq(sessionsTable.isActive, true)));

  let revoked = 0;
  for (const s of allSessions) {
    if (s.token !== currentJti) {
      await db.update(sessionsTable).set({ isActive: false, revokedAt: new Date() }).where(eq(sessionsTable.id, s.id));
      revoked++;
    }
  }
  res.json({ success: true, revoked });
});

export default router;
