import { Router } from "express";
import { db } from "@workspace/db";
import { appRatingsTable } from "@workspace/db/schema";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { eq, desc, avg, count } from "drizzle-orm";
import { genId } from "../lib/auth";

const router = Router();

// POST /api/ratings
router.post("/", requireAuth, async (req, res) => {
  const { stars, comment, suggestion } = req.body ?? {};
  const starsNum = parseInt(stars);
  if (!starsNum || starsNum < 1 || starsNum > 5) {
    res.status(400).json({ success: false, message: "stars must be 1–5" });
    return;
  }
  const user = req.user!;
  const existing = await db
    .select({ id: appRatingsTable.id })
    .from(appRatingsTable)
    .where(eq(appRatingsTable.userId, user.sub))
    .limit(1);

  if (existing[0]) {
    await db.update(appRatingsTable).set({
      stars: starsNum,
      comment: comment?.trim() ?? null,
      suggestion: suggestion?.trim() ?? null,
      updatedAt: new Date(),
    }).where(eq(appRatingsTable.userId, user.sub));
  } else {
    await db.insert(appRatingsTable).values({
      id: genId(),
      userId: user.sub,
      userEmail: user.email,
      userName: user.email,
      stars: starsNum,
      comment: comment?.trim() ?? null,
      suggestion: suggestion?.trim() ?? null,
    });
  }
  res.json({ success: true });
});

// GET /api/ratings/mine
router.get("/mine", requireAuth, async (req, res) => {
  const user = req.user!;
  const rating = await db
    .select()
    .from(appRatingsTable)
    .where(eq(appRatingsTable.userId, user.sub))
    .limit(1);
  res.json({ success: true, rating: rating[0] ?? null });
});

// GET /api/ratings/admin
router.get("/admin", requireAuth, requireRole("admin", "super_admin"), async (_req, res) => {
  const [ratings, stats] = await Promise.all([
    db.select().from(appRatingsTable).orderBy(desc(appRatingsTable.createdAt)),
    db.select({ avgStars: avg(appRatingsTable.stars), total: count() }).from(appRatingsTable),
  ]);
  res.json({ success: true, ratings, stats: stats[0] });
});

export default router;
