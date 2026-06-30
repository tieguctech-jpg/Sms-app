import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { paymentLogsTable, paymentProvidersTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";
import { genId } from "../lib/auth";
import { eq, desc } from "drizzle-orm";

const router = Router();

// POST /api/payments/create
router.post("/create", requireAuth, async (req, res) => {
  const { providerId, amount, currency = "USD", metadata = {} } = req.body ?? {};

  if (!providerId || !amount) {
    res.status(400).json({ success: false, message: "providerId and amount are required" });
    return;
  }

  const [provider] = await db
    .select()
    .from(paymentProvidersTable)
    .where(eq(paymentProvidersTable.id, providerId))
    .limit(1);

  if (!provider || !provider.isActive) {
    res.status(400).json({ success: false, message: "Payment provider is not available" });
    return;
  }

  const reference = `TXN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const id = genId();

  await db.insert(paymentLogsTable).values({
    id,
    providerId: provider.id,
    providerName: provider.name,
    userId: req.user!.sub,
    userEmail: req.user!.email,
    transactionId: null,
    reference,
    amount: String(amount),
    currency,
    status: "pending",
    metadata,
  });

  const cfg = (provider.config as Record<string, string>) ?? {};

  const checkoutData: Record<string, unknown> = {
    logId: id,
    reference,
    amount,
    currency,
    providerName: provider.name,
    providerDisplayName: provider.displayName,
  };

  if (provider.name === "stripe") {
    checkoutData.publishableKey = cfg.publishableKey ?? null;
  } else if (provider.name === "paystack") {
    checkoutData.publicKey = cfg.publicKey ?? null;
  } else if (provider.name === "flutterwave") {
    checkoutData.publicKey = cfg.publicKey ?? null;
  }

  res.json({ success: true, payment: checkoutData });
});

// POST /api/payments/verify
router.post("/verify", requireAuth, async (req, res) => {
  const { logId, reference, transactionId } = req.body ?? {};

  if (!logId && !reference) {
    res.status(400).json({ success: false, message: "logId or reference required" });
    return;
  }

  const condition = logId
    ? eq(paymentLogsTable.id, logId)
    : eq(paymentLogsTable.reference, reference as string);

  const [log] = await db.select().from(paymentLogsTable).where(condition).limit(1);

  if (!log) {
    res.status(404).json({ success: false, message: "Payment record not found" });
    return;
  }

  if (log.userId !== req.user!.sub) {
    res.status(403).json({ success: false, message: "Forbidden" });
    return;
  }

  if (log.status === "successful") {
    res.json({ success: true, message: "Payment already verified", status: "successful", amount: log.amount, currency: log.currency });
    return;
  }

  const verified = !!transactionId;
  await db.update(paymentLogsTable)
    .set({ status: verified ? "successful" : "failed", transactionId: transactionId ?? null, updatedAt: new Date() })
    .where(condition);

  res.json({
    success: verified,
    status: verified ? "successful" : "failed",
    message: verified ? "Payment verified successfully" : "Payment could not be verified",
    amount: log.amount,
    currency: log.currency,
  });
});

// POST /api/payments/refund
router.post("/refund", requireAuth, async (req, res) => {
  const { logId } = req.body ?? {};
  if (!logId) { res.status(400).json({ success: false, message: "logId required" }); return; }

  const [log] = await db.select().from(paymentLogsTable).where(eq(paymentLogsTable.id, logId)).limit(1);
  if (!log) { res.status(404).json({ success: false, message: "Transaction not found" }); return; }

  if (log.userId !== req.user!.sub && req.user!.role === "user") {
    res.status(403).json({ success: false, message: "Forbidden" }); return;
  }

  if (log.status !== "successful") {
    res.status(400).json({ success: false, message: "Only successful payments can be refunded" }); return;
  }

  await db.update(paymentLogsTable)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(paymentLogsTable.id, logId));

  res.json({ success: true, message: "Refund processed successfully" });
});

// GET /api/payments/history — user's own payment history
router.get("/history", requireAuth, async (req, res) => {
  const logs = await db
    .select()
    .from(paymentLogsTable)
    .where(eq(paymentLogsTable.userId, req.user!.sub))
    .orderBy(desc(paymentLogsTable.createdAt))
    .limit(50);

  res.json({ success: true, logs });
});

export default router;
