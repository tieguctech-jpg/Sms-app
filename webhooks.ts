import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { paymentLogsTable, paymentProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

async function getProviderConfig(name: string): Promise<Record<string, string>> {
  const [p] = await db
    .select({ config: paymentProvidersTable.config })
    .from(paymentProvidersTable)
    .where(eq(paymentProvidersTable.name, name))
    .limit(1);
  return (p?.config as Record<string, string>) ?? {};
}

async function completePayment(reference: string, transactionId: string): Promise<boolean> {
  const [log] = await db.select().from(paymentLogsTable).where(eq(paymentLogsTable.reference, reference)).limit(1);
  if (!log || log.status === "successful") return false;
  await db.update(paymentLogsTable)
    .set({ status: "successful", transactionId, updatedAt: new Date() })
    .where(eq(paymentLogsTable.reference, reference));
  return true;
}

// POST /api/webhooks/stripe
router.post("/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string | undefined;
  const cfg = await getProviderConfig("stripe");

  if (cfg.webhookSecret && sig) {
    const parts = sig.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2) ?? "";
    const received = parts.find((p) => p.startsWith("v1="))?.slice(3) ?? "";
    const payload = `${timestamp}.${JSON.stringify(req.body)}`;
    const expected = crypto.createHmac("sha256", cfg.webhookSecret).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"))) {
      logger.warn("Stripe webhook signature mismatch");
      res.status(400).json({ message: "Invalid signature" });
      return;
    }
  }

  const event = req.body as { type?: string; data?: { object?: Record<string, unknown> } };
  logger.info({ type: event.type }, "Stripe webhook received");

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const obj = event.data?.object ?? {};
    const reference = (obj.metadata as Record<string, string> | undefined)?.reference ?? (obj.client_reference_id as string);
    const transactionId = (obj.payment_intent ?? obj.id) as string;
    if (reference) await completePayment(reference, transactionId);
  }

  res.json({ received: true });
});

// POST /api/webhooks/paystack
router.post("/paystack", async (req, res) => {
  const hash = req.headers["x-paystack-signature"] as string | undefined;
  const cfg = await getProviderConfig("paystack");

  if (cfg.secretKey && hash) {
    const expected = crypto
      .createHmac("sha512", cfg.secretKey)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (hash !== expected) {
      logger.warn("Paystack webhook signature mismatch");
      res.status(400).json({ message: "Invalid signature" });
      return;
    }
  }

  const event = req.body as { event?: string; data?: Record<string, unknown> };
  logger.info({ event: event.event }, "Paystack webhook received");

  if (event.event === "charge.success" && event.data) {
    const data = event.data;
    await completePayment(data.reference as string, String(data.id));
  }

  res.status(200).send("OK");
});

// POST /api/webhooks/flutterwave
router.post("/flutterwave", async (req, res) => {
  const verifHash = req.headers["verif-hash"] as string | undefined;
  const cfg = await getProviderConfig("flutterwave");
  const secretHash = cfg.encryptionKey ?? cfg.secretKey;

  if (secretHash && verifHash !== secretHash) {
    logger.warn("Flutterwave webhook hash mismatch");
    res.status(400).json({ message: "Invalid hash" });
    return;
  }

  const event = req.body as { event?: string; data?: Record<string, unknown> };
  logger.info({ type: event.event }, "Flutterwave webhook received");

  if (event.event === "charge.completed" && event.data?.status === "successful") {
    const data = event.data;
    await completePayment(data.tx_ref as string, String(data.id));
  }

  res.status(200).send("OK");
});

export default router;
