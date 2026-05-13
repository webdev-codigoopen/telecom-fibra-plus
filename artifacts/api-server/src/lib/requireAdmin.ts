import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0]!.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  const headerKey = req.headers["x-admin-key"];
  const key = typeof headerKey === "string" ? headerKey : "";
  if (!key || !safeEqual(key, secret)) {
    logger.warn(
      {
        ip: clientIp(req),
        path: req.path,
        method: req.method,
        ua: req.headers["user-agent"],
      },
      "admin: unauthorized access attempt",
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
