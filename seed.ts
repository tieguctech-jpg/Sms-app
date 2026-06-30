import { db } from "@workspace/db";
import { usersTable, paymentProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, genId } from "./auth";
import { logger } from "./logger";

const SUPER_ADMIN_EMAIL = "tiegmicheal@gmail.com";
const SUPER_ADMIN_PASSWORD = "333556";
const SUPER_ADMIN_NAME = "Michael Tieg";

export async function seedSuperAdmin() {
  try {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, SUPER_ADMIN_EMAIL))
      .limit(1);

    if (existing.length > 0) {
      logger.info("Super admin already exists, skipping seed");
    } else {
      const passwordHash = await hashPassword(SUPER_ADMIN_PASSWORD);
      await db.insert(usersTable).values({
        id: genId(),
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        name: SUPER_ADMIN_NAME,
        role: "super_admin",
      });
      logger.info({ email: SUPER_ADMIN_EMAIL }, "Super admin created");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed super admin");
  }

  await seedPaymentProviders();
}

// ─── Default payment providers (idempotent) ───────────────────────────────────
const DEFAULT_PROVIDERS: Array<{
  name: string;
  displayName: string;
  regions: string[];
  priority: number;
}> = [
  { name: "stripe",              displayName: "Stripe",             regions: ["US","GB","CA","AU","DE","FR","NL","SE","NO","FI","ES","IT","JP","SG","AE"], priority: 10 },
  { name: "paystack",            displayName: "Paystack",           regions: ["NG","GH","ZA","KE","RW","TZ","UG","CI"],                                    priority: 20 },
  { name: "flutterwave",         displayName: "Flutterwave",        regions: ["NG","GH","KE","ZA","TZ","UG","RW","EG","CM","US","GB"],                      priority: 30 },
  { name: "apple_iap",           displayName: "Apple Billing (IAP)",regions: [],                                                                            priority: 5  },
  { name: "google_play_billing", displayName: "Google Play Billing",regions: [],                                                                            priority: 6  },
  { name: "bank_transfer",       displayName: "Bank Transfer",      regions: [],                                                                            priority: 50 },
];

async function seedPaymentProviders() {
  try {
    for (const p of DEFAULT_PROVIDERS) {
      const existing = await db
        .select({ id: paymentProvidersTable.id })
        .from(paymentProvidersTable)
        .where(eq(paymentProvidersTable.name, p.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(paymentProvidersTable).values({
          id: genId(),
          name: p.name,
          displayName: p.displayName,
          isBuiltIn: true,
          isActive: false,
          isAutoEnabled: true,
          supportedRegions: p.regions,
          config: {},
          customFields: [],
          status: "coming_soon",
          priority: p.priority,
        });
        logger.info({ name: p.name }, "Seeded payment provider");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed payment providers");
  }
}
