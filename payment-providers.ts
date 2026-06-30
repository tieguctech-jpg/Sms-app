import { Router } from "express";
import { db } from "@workspace/db";
import { paymentProvidersTable } from "@workspace/db/schema";

const router = Router();

// GET /api/payment-providers — public: which providers exist & their active status (no keys)
router.get("/", async (_req, res) => {
  const providers = await db
    .select({
      id: paymentProvidersTable.id,
      name: paymentProvidersTable.name,
      displayName: paymentProvidersTable.displayName,
      isActive: paymentProvidersTable.isActive,
      isAutoEnabled: paymentProvidersTable.isAutoEnabled,
      supportedRegions: paymentProvidersTable.supportedRegions,
      status: paymentProvidersTable.status,
      priority: paymentProvidersTable.priority,
    })
    .from(paymentProvidersTable)
    .orderBy(paymentProvidersTable.priority, paymentProvidersTable.name);

  res.json({ success: true, providers });
});

export default router;
