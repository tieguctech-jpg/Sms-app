import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../lib/auth";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);

    // Verify session is still active
    const session = await db
      .select({ id: sessionsTable.id, isActive: sessionsTable.isActive })
      .from(sessionsTable)
      .where(and(eq(sessionsTable.token, payload.jti), eq(sessionsTable.isActive, true)))
      .limit(1);

    if (!session[0]?.isActive) {
      res.status(401).json({ success: false, message: "Session expired or revoked" });
      return;
    }

    // Update last activity
    await db
      .update(sessionsTable)
      .set({ lastActivity: new Date() })
      .where(eq(sessionsTable.token, payload.jti));

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }
    next();
  };
}
