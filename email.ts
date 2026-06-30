import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { emailSettingsTable } from "@workspace/db/schema";

// ─── Resolved SMTP config ─────────────────────────────────────────────────────
interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

// ─── DB-backed config cache (refreshed per-call) ──────────────────────────────
async function getEmailConfig(): Promise<SmtpConfig | null> {
  try {
    const rows = await db.select().from(emailSettingsTable).limit(1);
    const cfg = rows[0];
    // A DB row is authoritative: respect the admin enable/disable toggle and
    // do NOT silently fall back to env when a row exists but is disabled.
    if (cfg) {
      if (cfg.isEnabled && cfg.smtpHost && cfg.smtpUser && cfg.smtpPassword) {
        return {
          host: cfg.smtpHost,
          port: cfg.smtpPort,
          user: cfg.smtpUser,
          pass: cfg.smtpPassword,
          from: cfg.fromEmail || cfg.smtpUser,
          fromName: cfg.fromName || "OTP Market",
        };
      }
      // Row exists but is disabled or incomplete — sending is off.
      return null;
    }
  } catch {
    // DB not ready — fall through to env fallback (bootstrap only).
  }
  // Env var fallback applies only when no DB row exists yet (bootstrap/dev).
  const host = process.env["SMTP_HOST"] || "smtp-relay.brevo.com";
  const port = process.env["SMTP_PORT"] ? Number(process.env["SMTP_PORT"]) : 587;
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (user && pass) {
    return {
      host,
      port,
      user,
      pass,
      from: process.env["SMTP_FROM"] || user,
      fromName: process.env["SMTP_FROM_NAME"] || "OTP Market",
    };
  }
  return null;
}

async function createTransportFromDb() {
  const cfg = await getEmailConfig();
  if (!cfg) return null;
  return {
    transport: nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    }),
    from: cfg.from,
    fromName: cfg.fromName,
  };
}

export async function isConfigured(): Promise<boolean> {
  const cfg = await getEmailConfig();
  return !!cfg;
}

// ─── Shared HTML layout ───────────────────────────────────────────────────────
function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF9F6;min-height:100vh;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <!-- Logo header -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#C8A97E,#A0835A);border-radius:16px;padding:14px 20px;">
                  <span style="color:#1A1A1A;font-size:20px;font-weight:800;letter-spacing:1px;">OTP</span>
                  <span style="color:#1A1A1A;font-size:20px;font-weight:400;"> Market</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:#FFFFFF;border-radius:20px;border:1px solid #E8E3DC;padding:36px 40px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:12px;color:#9B8E7E;">
              This email was sent by OTP Market. If you didn't request this, please ignore it.
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#C8A97E;">© 2025 OTP Market. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function codeBlock(code: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#FAF9F6;border:2px solid #C8A97E;border-radius:16px;padding:20px 36px;">
              <span style="font-size:38px;font-weight:800;color:#1A1A1A;letter-spacing:12px;">${code}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// ─── Password reset email ─────────────────────────────────────────────────────
export async function sendPasswordResetEmail(toEmail: string, code: string, name: string): Promise<void> {
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1A1A1A;">Reset Your Password</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#5C5147;">Hi ${name || "there"},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5147;line-height:1.6;">
      We received a request to reset your OTP Market password. Use the 6-digit code below to continue.
      This code expires in <strong>15 minutes</strong>.
    </p>
    ${codeBlock(code)}
    <div style="background:#FEF3CD;border:1px solid #F5D78E;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92600A;">
        <strong>Security notice:</strong> If you didn't request a password reset, you can safely ignore this email. Your account remains secure.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#9B8E7E;">
      The code will expire in 15 minutes from when this email was sent. Do not share this code with anyone.
    </p>`;

  await sendMail({
    to: toEmail,
    subject: "Reset your OTP Market password",
    html: layout("Reset Password – OTP Market", body),
  });
}

// ─── Email verification email ─────────────────────────────────────────────────
export async function sendVerificationEmail(toEmail: string, code: string, name: string): Promise<void> {
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1A1A1A;">Verify Your Email</h1>
    <p style="margin:0 0 4px;font-size:15px;color:#5C5147;">Welcome to OTP Market, ${name || "there"}! 🎉</p>
    <p style="margin:0 0 20px;font-size:15px;color:#5C5147;line-height:1.6;">
      To finish setting up your account, please verify your email address using the 6-digit code below.
      This code expires in <strong>24 hours</strong>.
    </p>
    ${codeBlock(code)}
    <p style="margin:0 0 20px;font-size:15px;color:#5C5147;line-height:1.6;">
      Once verified, you'll have full access to purchase virtual phone numbers for OTP codes across all supported services.
    </p>
    <p style="margin:0;font-size:13px;color:#9B8E7E;">
      If you didn't create an OTP Market account, please ignore this email.
    </p>`;

  await sendMail({
    to: toEmail,
    subject: "Verify your OTP Market email address",
    html: layout("Verify Email – OTP Market", body),
  });
}

// ─── Generic notification email ───────────────────────────────────────────────
export async function sendNotificationEmail(toEmail: string, subject: string, bodyHtml: string): Promise<void> {
  await sendMail({ to: toEmail, subject, html: layout(subject, bodyHtml) });
}

// ─── Internal send helper ─────────────────────────────────────────────────────
async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const result = await createTransportFromDb();
  if (!result) {
    console.warn(`[Email] Not configured. Would have sent to ${to}: ${subject}`);
    return;
  }
  const { transport, from, fromName } = result;
  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to,
    subject,
    html,
  });
}
