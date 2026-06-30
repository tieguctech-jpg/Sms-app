import { Router } from "express";
import { db } from "@workspace/db";
import { emailSettingsTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { audit } from "../../lib/audit";
import nodemailer from "nodemailer";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// ─── GET /api/admin/email-config ──────────────────────────────────────────────
router.get("/", async (req, res) => {
  const rows = await db.select().from(emailSettingsTable).limit(1);
  const cfg = rows[0] ?? null;
  res.json({
    success: true,
    config: cfg
      ? {
          id: cfg.id,
          smtpHost: cfg.smtpHost,
          smtpPort: cfg.smtpPort,
          smtpUser: cfg.smtpUser,
          fromEmail: cfg.fromEmail,
          fromName: cfg.fromName,
          // Never return the actual password — just whether it's set
          hasPassword: !!cfg.smtpPassword,
          isEnabled: cfg.isEnabled,
          lastTestedAt: cfg.lastTestedAt,
          lastTestResult: cfg.lastTestResult,
          lastTestEmail: cfg.lastTestEmail,
          updatedAt: cfg.updatedAt,
        }
      : null,
    devMode: !cfg?.isEnabled || !cfg?.smtpUser || !cfg?.smtpPassword,
  });
});

// ─── PUT /api/admin/email-config ──────────────────────────────────────────────
router.put("/", async (req, res) => {
  const { smtpHost, smtpPort, smtpUser, smtpPassword, fromEmail, fromName, isEnabled } =
    req.body as {
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      fromEmail?: string;
      fromName?: string;
      isEnabled?: boolean;
    };

  if (
    smtpPort !== undefined &&
    (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
  ) {
    res.status(400).json({ success: false, message: "smtpPort must be an integer between 1 and 65535." });
    return;
  }
  if (fromEmail !== undefined && fromEmail.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail.trim())) {
    res.status(400).json({ success: false, message: "fromEmail must be a valid email address." });
    return;
  }

  const existing = await db.select().from(emailSettingsTable).limit(1);
  const actorId = req.user!.sub;
  const actorEmail = req.user!.email;

  if (existing.length === 0) {
    await db.insert(emailSettingsTable).values({
      smtpHost: smtpHost?.trim() || "smtp-relay.brevo.com",
      smtpPort: smtpPort ?? 587,
      smtpUser: smtpUser?.trim() || null,
      smtpPassword: smtpPassword?.trim() || null,
      fromEmail: fromEmail?.trim() || null,
      fromName: fromName?.trim() || "OTP Market",
      isEnabled: isEnabled ?? false,
      updatedBy: actorId,
      updatedAt: new Date(),
    });
  } else {
    const update: Partial<typeof emailSettingsTable.$inferInsert> = {
      updatedAt: new Date(),
      updatedBy: actorId,
    };
    if (smtpHost !== undefined) update.smtpHost = smtpHost.trim() || "smtp-relay.brevo.com";
    if (smtpPort !== undefined) update.smtpPort = smtpPort;
    if (smtpUser !== undefined) update.smtpUser = smtpUser.trim() || null;
    if (smtpPassword !== undefined && smtpPassword.trim() !== "") {
      update.smtpPassword = smtpPassword.trim();
    }
    if (fromEmail !== undefined) update.fromEmail = fromEmail.trim() || null;
    if (fromName !== undefined) update.fromName = fromName.trim() || "OTP Market";
    if (isEnabled !== undefined) update.isEnabled = isEnabled;

    await db.update(emailSettingsTable).set(update);
  }

  await audit({
    actorId,
    actorEmail,
    action: "admin.email_config.update",
    metadata: { smtpHost, smtpUser, fromEmail, isEnabled, passwordChanged: !!smtpPassword?.trim() },
  });

  res.json({ success: true, message: "Email configuration saved." });
});

// ─── POST /api/admin/email-config/test ────────────────────────────────────────
router.post("/test", async (req, res) => {
  const { testEmail } = req.body as { testEmail: string };
  if (!testEmail) {
    res.status(400).json({ success: false, message: "testEmail is required." });
    return;
  }

  const rows = await db.select().from(emailSettingsTable).limit(1);
  const cfg = rows[0];
  if (!cfg || !cfg.smtpUser || !cfg.smtpPassword) {
    res.status(400).json({ success: false, message: "Email not configured. Add SMTP credentials first." });
    return;
  }
  if (!cfg.isEnabled) {
    res.status(400).json({ success: false, message: "Email system is disabled. Enable it first." });
    return;
  }

  const fromAddress = cfg.fromEmail || cfg.smtpUser;
  const fromName = cfg.fromName || "OTP Market";
  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    auth: { user: cfg.smtpUser, pass: cfg.smtpPassword },
  });

  const now = new Date().toISOString();
  let testResult = "success";
  try {
    await transport.sendMail({
      from: `"${fromName} Admin" <${fromAddress}>`,
      to: testEmail,
      subject: "OTP Market — Email System Test",
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Email Test</title></head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td align="center" style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#C8A97E,#A0835A);border-radius:16px;padding:14px 20px;">
              <span style="color:#1A1A1A;font-size:20px;font-weight:800;letter-spacing:1px;">OTP</span>
              <span style="color:#1A1A1A;font-size:20px;font-weight:400;"> Market</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#FFFFFF;border-radius:20px;border:1px solid #E8E3DC;padding:36px 40px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#1A1A1A;">✅ Email System Working!</h1>
          <p style="margin:0 0 12px;font-size:15px;color:#5C5147;line-height:1.6;">
            Your OTP Market email configuration is working correctly.
          </p>
          <div style="background:#F0FAF0;border:1px solid #86EFAC;border-radius:12px;padding:14px 18px;margin:20px 0;">
            <p style="margin:0;font-size:13px;color:#166534;">
              <strong>Sender:</strong> ${fromAddress}<br/>
              <strong>Tested at:</strong> ${now}
            </p>
          </div>
          <p style="margin:0;font-size:13px;color:#9B8E7E;">
            This is an automated test email sent from the OTP Market Admin Dashboard.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
  } catch (err: unknown) {
    testResult = err instanceof Error ? err.message : "Unknown error";
  }

  // Save test result
  await db.update(emailSettingsTable).set({
    lastTestedAt: new Date(),
    lastTestResult: testResult,
    lastTestEmail: testEmail,
  });

  await audit({
    actorId: req.user!.sub,
    actorEmail: req.user!.email,
    action: "admin.email_config.test",
    metadata: { testEmail, result: testResult },
  });

  if (testResult === "success") {
    res.json({ success: true, message: `Test email sent to ${testEmail}` });
  } else {
    res.status(500).json({ success: false, message: `Email failed: ${testResult}` });
  }
});

export default router;
