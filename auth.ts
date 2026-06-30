import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  sessionsTable,
  resetCodesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  genId,
  hashPassword,
  verifyPassword,
  signToken,
  detectDevice,
  getIp,
} from "../lib/auth";
import { audit } from "../lib/audit";
import { requireAuth } from "../middlewares/requireAuth";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  isConfigured,
} from "../lib/email";

const router = Router();

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || !name) {
    res.status(400).json({ success: false, message: "email, password and name are required" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ success: false, message: "An account with that email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const userId = genId();
  await db.insert(usersTable).values({
    id: userId,
    email: email.toLowerCase().trim(),
    passwordHash,
    name: name.trim(),
    role: "user",
    emailVerified: false,
  });

  await audit({
    actorId: userId,
    actorEmail: email,
    action: "auth.signup",
    ipAddress: getIp(req),
  });

  // Send verification email
  await _issueVerificationCode(email.toLowerCase().trim(), name.trim());

  res.status(201).json({
    success: true,
    message: "Account created. Check your email for a verification code.",
    userId,
    verificationSent: isConfigured(),
  });
});

// ─── POST /api/auth/signin ────────────────────────────────────────────────────
router.post("/signin", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ success: false, message: "email and password are required" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  const user = users[0];
  if (!user) {
    res.status(401).json({ success: false, message: "No account found with that email" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: "Incorrect password" });
    return;
  }

  // Create session
  const sessionId = genId();
  const ip = getIp(req);
  const ua = req.headers["user-agent"];
  const deviceType = detectDevice(ua);

  await db.insert(sessionsTable).values({
    id: genId(),
    userId: user.id,
    token: sessionId,
    deviceType,
    userAgent: ua ?? null,
    ipAddress: ip,
    location: null,
    isActive: true,
    lastActivity: new Date(),
  });

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    jti: sessionId,
  });

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "auth.signin",
    ipAddress: ip,
    metadata: { deviceType },
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/logout", requireAuth, async (req, res) => {
  const { jti, sub, email } = req.user!;
  await db
    .update(sessionsTable)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(sessionsTable.token, jti));

  await audit({
    actorId: sub,
    actorEmail: email,
    action: "auth.logout",
    ipAddress: getIp(req),
  });

  res.json({ success: true, message: "Logged out successfully" });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ success: false, message: "email is required" });
    return;
  }

  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  // Always return success to prevent email enumeration
  if (users.length === 0) {
    res.json({ success: true, message: "If that email is registered, a reset code has been sent." });
    return;
  }

  const user = users[0]!;

  // Invalidate old reset codes
  await db
    .update(resetCodesTable)
    .set({ used: true })
    .where(
      and(
        eq(resetCodesTable.email, email.toLowerCase().trim()),
        eq(resetCodesTable.type, "reset")
      )
    );

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await db.insert(resetCodesTable).values({
    id: genId(),
    email: email.toLowerCase().trim(),
    code,
    type: "reset",
    expiresAt,
    used: false,
  });

  await audit({
    actorEmail: email,
    action: "auth.forgot_password",
    ipAddress: getIp(req),
  });

  // Send real email via Gmail/Nodemailer
  await sendPasswordResetEmail(email.toLowerCase().trim(), code, user.name);

  // Return devCode only when email service is NOT configured (dev fallback)
  const isDev = !isConfigured();
  res.json({
    success: true,
    message: "If that email is registered, a reset code has been sent.",
    emailSent: isConfigured(),
    ...(isDev ? { _devCode: code } : {}),
  });
});

// ─── POST /api/auth/verify-reset-code ────────────────────────────────────────
router.post("/verify-reset-code", async (req, res) => {
  const { email, code } = req.body ?? {};
  if (!email || !code) {
    res.status(400).json({ success: false, message: "email and code are required" });
    return;
  }

  const records = await db
    .select()
    .from(resetCodesTable)
    .where(
      and(
        eq(resetCodesTable.email, email.toLowerCase().trim()),
        eq(resetCodesTable.code, code.trim()),
        eq(resetCodesTable.type, "reset"),
        eq(resetCodesTable.used, false)
      )
    )
    .limit(1);

  const record = records[0];
  if (!record) {
    res.status(400).json({ success: false, message: "Invalid or expired code" });
    return;
  }

  if (new Date() > record.expiresAt) {
    res.status(400).json({ success: false, message: "Code has expired. Please request a new one." });
    return;
  }

  res.json({ success: true, message: "Code verified successfully" });
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body ?? {};
  if (!email || !code || !newPassword) {
    res.status(400).json({ success: false, message: "email, code and newPassword are required" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    return;
  }

  const records = await db
    .select()
    .from(resetCodesTable)
    .where(
      and(
        eq(resetCodesTable.email, email.toLowerCase().trim()),
        eq(resetCodesTable.code, code.trim()),
        eq(resetCodesTable.type, "reset"),
        eq(resetCodesTable.used, false)
      )
    )
    .limit(1);

  const record = records[0];
  if (!record || new Date() > record.expiresAt) {
    res.status(400).json({ success: false, message: "Invalid or expired code" });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  // Mark code as used
  await db
    .update(resetCodesTable)
    .set({ used: true })
    .where(eq(resetCodesTable.id, record.id));

  // Revoke all existing sessions for security
  const userRows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (userRows[0]) {
    await db
      .update(sessionsTable)
      .set({ isActive: false, revokedAt: new Date() })
      .where(
        and(
          eq(sessionsTable.userId, userRows[0].id),
          eq(sessionsTable.isActive, true)
        )
      );
  }

  await audit({
    actorEmail: email,
    action: "auth.reset_password",
    ipAddress: getIp(req),
  });

  res.json({ success: true, message: "Password updated successfully" });
});

// ─── POST /api/auth/send-verification ────────────────────────────────────────
router.post("/send-verification", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ success: false, message: "email is required" });
    return;
  }

  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, emailVerified: usersTable.emailVerified })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!users[0]) {
    // Always respond success to prevent enumeration
    res.json({ success: true, message: "Verification code sent if account exists." });
    return;
  }

  if (users[0].emailVerified) {
    res.json({ success: true, message: "Email already verified.", alreadyVerified: true });
    return;
  }

  const { _devCode } = await _issueVerificationCode(email.toLowerCase().trim(), users[0].name);

  res.json({
    success: true,
    message: "Verification code sent to your email.",
    emailSent: isConfigured(),
    ...(_devCode ? { _devCode } : {}),
  });
});

// ─── POST /api/auth/verify-email ─────────────────────────────────────────────
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body ?? {};
  if (!email || !code) {
    res.status(400).json({ success: false, message: "email and code are required" });
    return;
  }

  const records = await db
    .select()
    .from(resetCodesTable)
    .where(
      and(
        eq(resetCodesTable.email, email.toLowerCase().trim()),
        eq(resetCodesTable.code, code.trim()),
        eq(resetCodesTable.type, "verify"),
        eq(resetCodesTable.used, false)
      )
    )
    .limit(1);

  const record = records[0];
  if (!record) {
    res.status(400).json({ success: false, message: "Invalid or expired code" });
    return;
  }

  if (new Date() > record.expiresAt) {
    res.status(400).json({ success: false, message: "Code has expired. Please request a new one." });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  await db
    .update(resetCodesTable)
    .set({ used: true })
    .where(eq(resetCodesTable.id, record.id));

  await audit({
    actorEmail: email,
    action: "auth.email_verified",
    ipAddress: getIp(req),
  });

  res.json({ success: true, message: "Email verified successfully" });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      emailVerified: usersTable.emailVerified,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.sub))
    .limit(1);

  const user = users[0];
  if (!user) {
    res.status(404).json({ success: false, message: "User not found" });
    return;
  }

  res.json({ success: true, user });
});

// ─── PATCH /api/auth/me ───────────────────────────────────────────────────────
router.patch("/me", requireAuth, async (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ success: false, message: "name is required" });
    return;
  }
  const user = req.user!;
  await db
    .update(usersTable)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.sub));
  await audit({ actorId: user.sub, actorEmail: user.email, action: "auth.update_profile", ipAddress: getIp(req) });
  const updated = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role, emailVerified: usersTable.emailVerified })
    .from(usersTable).where(eq(usersTable.id, user.sub)).limit(1);
  res.json({ success: true, user: updated[0] });
});

// ─── Internal helper ──────────────────────────────────────────────────────────
async function _issueVerificationCode(
  email: string,
  name: string
): Promise<{ _devCode?: string }> {
  // Invalidate old verify codes for this email
  await db
    .update(resetCodesTable)
    .set({ used: true })
    .where(
      and(
        eq(resetCodesTable.email, email),
        eq(resetCodesTable.type, "verify")
      )
    );

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(resetCodesTable).values({
    id: genId(),
    email,
    code,
    type: "verify",
    expiresAt,
    used: false,
  });

  await sendVerificationEmail(email, code, name);

  // Only expose devCode when email service not configured
  if (!isConfigured()) {
    return { _devCode: code };
  }
  return {};
}

export default router;
