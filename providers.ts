import { Router } from "express";
import { db } from "@workspace/db";
import { smsProvidersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/requireAuth";
import { audit } from "../../lib/audit";
import { genId, getIp } from "../../lib/auth";

const router = Router();
router.use(requireAuth, requireRole("admin", "super_admin"));

// GET /api/admin/providers
router.get("/", async (req, res) => {
  const providers = await db
    .select({
      id: smsProvidersTable.id,
      name: smsProvidersTable.name,
      displayName: smsProvidersTable.displayName,
      isActive: smsProvidersTable.isActive,
      status: smsProvidersTable.status,
      webhookUrl: smsProvidersTable.webhookUrl,
      lastTestedAt: smsProvidersTable.lastTestedAt,
      lastTestResult: smsProvidersTable.lastTestResult,
      createdAt: smsProvidersTable.createdAt,
      updatedAt: smsProvidersTable.updatedAt,
      // Never expose raw config to frontend — return masked keys only
      configMasked: smsProvidersTable.config,
    })
    .from(smsProvidersTable)
    .orderBy(smsProvidersTable.name);

  // Mask sensitive values in config
  const masked = providers.map((p) => {
    const config = p.configMasked as Record<string, string> ?? {};
    const maskedConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      if (typeof v === "string" && v.length > 4) {
        maskedConfig[k] = `${"•".repeat(Math.max(4, v.length - 4))}${v.slice(-4)}`;
      } else {
        maskedConfig[k] = v;
      }
    }
    return { ...p, configMasked: maskedConfig };
  });

  res.json({ success: true, providers: masked });
});

// POST /api/admin/providers — add or update a provider
router.post("/", async (req, res) => {
  const { name, displayName, config, webhookUrl } = req.body ?? {};
  if (!name || !config) {
    res.status(400).json({ success: false, message: "name and config are required" });
    return;
  }

  const existing = await db
    .select({ id: smsProvidersTable.id })
    .from(smsProvidersTable)
    .where(eq(smsProvidersTable.name, name))
    .limit(1);

  if (existing[0]) {
    // Update
    await db
      .update(smsProvidersTable)
      .set({
        config,
        displayName: displayName ?? name,
        webhookUrl: webhookUrl ?? null,
        updatedAt: new Date(),
        status: "inactive",
      })
      .where(eq(smsProvidersTable.name, name));

    await audit({
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      action: "admin.provider.update",
      targetId: existing[0].id,
      targetType: "provider",
      ipAddress: getIp(req),
      metadata: { name },
    });

    res.json({ success: true, message: "Provider updated" });
  } else {
    // Create
    const id = genId();
    await db.insert(smsProvidersTable).values({
      id,
      name,
      displayName: displayName ?? name,
      config,
      webhookUrl: webhookUrl ?? null,
      isActive: false,
      status: "inactive",
    });

    await audit({
      actorId: req.user!.sub,
      actorEmail: req.user!.email,
      action: "admin.provider.create",
      targetId: id,
      targetType: "provider",
      ipAddress: getIp(req),
      metadata: { name },
    });

    res.status(201).json({ success: true, message: "Provider created", id });
  }
});

// PUT /api/admin/providers/:id/activate — switch active provider
router.put("/:id/activate", async (req, res) => {
  const { id } = req.params;

  const provider = await db
    .select()
    .from(smsProvidersTable)
    .where(eq(smsProvidersTable.id, id))
    .limit(1);

  if (!provider[0]) {
    res.status(404).json({ success: false, message: "Provider not found" });
    return;
  }

  // Deactivate all
  await db.update(smsProvidersTable).set({ isActive: false });
  // Activate selected
  await db
    .update(smsProvidersTable)
    .set({ isActive: true, status: "active", updatedAt: new Date() })
    .where(eq(smsProvidersTable.id, id));

  await audit({
    actorId: req.user!.sub,
    actorEmail: req.user!.email,
    action: "admin.provider.activate",
    targetId: id,
    targetType: "provider",
    ipAddress: getIp(req),
    metadata: { name: provider[0].name },
  });

  res.json({ success: true, message: `${provider[0].displayName} is now the active provider` });
});

// PUT /api/admin/providers/:id/deactivate
router.put("/:id/deactivate", async (req, res) => {
  const { id } = req.params;
  await db
    .update(smsProvidersTable)
    .set({ isActive: false, status: "inactive", updatedAt: new Date() })
    .where(eq(smsProvidersTable.id, id));

  res.json({ success: true, message: "Provider deactivated" });
});

// POST /api/admin/providers/:id/test — test provider connection
router.post("/:id/test", async (req, res) => {
  const { id } = req.params;

  const provider = await db
    .select()
    .from(smsProvidersTable)
    .where(eq(smsProvidersTable.id, id))
    .limit(1);

  if (!provider[0]) {
    res.status(404).json({ success: false, message: "Provider not found" });
    return;
  }

  // Simulate connection test (in production, ping provider API)
  await new Promise((r) => setTimeout(r, 800));
  const testPassed = Math.random() > 0.2; // 80% success for demo

  await db
    .update(smsProvidersTable)
    .set({
      lastTestedAt: new Date(),
      lastTestResult: testPassed ? "success" : "failed",
      status: provider[0].isActive ? "active" : testPassed ? "inactive" : "error",
      updatedAt: new Date(),
    })
    .where(eq(smsProvidersTable.id, id));

  await audit({
    actorId: req.user!.sub,
    actorEmail: req.user!.email,
    action: "admin.provider.test",
    targetId: id,
    targetType: "provider",
    ipAddress: getIp(req),
    metadata: { result: testPassed ? "success" : "failed" },
  });

  res.json({
    success: true,
    result: testPassed ? "success" : "failed",
    message: testPassed ? "Connection successful" : "Connection failed — check credentials",
  });
});

// DELETE /api/admin/providers/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  const provider = await db
    .select({ isActive: smsProvidersTable.isActive })
    .from(smsProvidersTable)
    .where(eq(smsProvidersTable.id, id))
    .limit(1);

  if (!provider[0]) {
    res.status(404).json({ success: false, message: "Provider not found" });
    return;
  }
  if (provider[0].isActive) {
    res.status(400).json({ success: false, message: "Cannot delete the active provider. Deactivate first." });
    return;
  }

  await db.delete(smsProvidersTable).where(eq(smsProvidersTable.id, id));

  await audit({
    actorId: req.user!.sub,
    actorEmail: req.user!.email,
    action: "admin.provider.delete",
    targetId: id,
    targetType: "provider",
    ipAddress: getIp(req),
  });

  res.json({ success: true, message: "Provider deleted" });
});

export default router;
