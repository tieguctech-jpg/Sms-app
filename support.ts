import { Router } from "express";
import { db } from "@workspace/db";
import { supportTicketsTable, supportMessagesTable } from "@workspace/db/schema";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, and, desc } from "drizzle-orm";
import { genId } from "../lib/auth";

const router = Router();
router.use(requireAuth);

// POST /api/support/tickets
router.post("/tickets", async (req, res) => {
  const { subject, category, message } = req.body ?? {};
  if (!subject?.trim() || !category || !message?.trim()) {
    res.status(400).json({ success: false, message: "subject, category and message are required" });
    return;
  }
  const validCategories = ["payment_issues", "otp_issues", "wallet_issues", "account_issues", "technical_problems", "other"];
  if (!validCategories.includes(category)) {
    res.status(400).json({ success: false, message: "Invalid category" });
    return;
  }
  const user = req.user!;
  const ticketId = genId();
  await db.insert(supportTicketsTable).values({
    id: ticketId,
    userId: user.sub,
    userEmail: user.email,
    userName: user.email,
    subject: subject.trim(),
    category,
    status: "open",
  });
  await db.insert(supportMessagesTable).values({
    id: genId(),
    ticketId,
    senderId: user.sub,
    senderEmail: user.email,
    senderName: user.email,
    senderRole: "user",
    message: message.trim(),
  });
  res.status(201).json({ success: true, ticketId });
});

// GET /api/support/tickets
router.get("/tickets", async (req, res) => {
  const user = req.user!;
  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.sub))
    .orderBy(desc(supportTicketsTable.updatedAt));
  res.json({ success: true, tickets });
});

// GET /api/support/tickets/:id
router.get("/tickets/:id", async (req, res) => {
  const user = req.user!;
  const [ticket, messages] = await Promise.all([
    db.select().from(supportTicketsTable)
      .where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.userId, user.sub)))
      .limit(1),
    db.select().from(supportMessagesTable)
      .where(eq(supportMessagesTable.ticketId, req.params.id))
      .orderBy(supportMessagesTable.createdAt),
  ]);
  if (!ticket[0]) { res.status(404).json({ success: false, message: "Not found" }); return; }
  res.json({ success: true, ticket: ticket[0], messages });
});

// POST /api/support/tickets/:id/reply
router.post("/tickets/:id/reply", async (req, res) => {
  const { message } = req.body ?? {};
  if (!message?.trim()) { res.status(400).json({ success: false, message: "Message required" }); return; }
  const user = req.user!;
  const ticket = await db
    .select({ id: supportTicketsTable.id, status: supportTicketsTable.status })
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.userId, user.sub)))
    .limit(1);
  if (!ticket[0]) { res.status(404).json({ success: false, message: "Not found" }); return; }
  if (ticket[0].status === "closed") { res.status(400).json({ success: false, message: "Ticket is closed" }); return; }
  await db.insert(supportMessagesTable).values({
    id: genId(),
    ticketId: req.params.id,
    senderId: user.sub,
    senderEmail: user.email,
    senderName: user.email,
    senderRole: "user",
    message: message.trim(),
  });
  await db.update(supportTicketsTable)
    .set({ updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, req.params.id));
  res.json({ success: true });
});

// POST /api/support/tickets/:id/close
router.post("/tickets/:id/close", async (req, res) => {
  const user = req.user!;
  await db.update(supportTicketsTable)
    .set({ status: "closed", updatedAt: new Date() })
    .where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.userId, user.sub)));
  res.json({ success: true });
});

export default router;
