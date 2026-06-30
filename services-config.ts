import { Router } from "express";
import { db } from "@workspace/db";
import { servicesConfigTable } from "@workspace/db/schema";

const router = Router();

// GET /api/services-config — public: returns enabled state + admin price for all configured services
router.get("/", async (_req, res) => {
  const configs = await db
    .select({
      serviceId: servicesConfigTable.serviceId,
      isEnabled: servicesConfigTable.isEnabled,
      adminPrice: servicesConfigTable.adminPrice,
    })
    .from(servicesConfigTable);

  res.json({ success: true, configs });
});

export default router;
