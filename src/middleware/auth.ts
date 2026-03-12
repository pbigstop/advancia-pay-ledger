import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    facilityId?: string;
  };
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  facilityId?: string;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
}

function verifyJwt(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not set");
  }
  return jwt.verify(token, secret) as JwtPayload;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    const decoded = verifyJwt(token);
    (req as AuthRequest).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as AuthRequest).user;
  if (!user || !["admin", "cfo", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function generateToken(payload: {
  id: string;
  email: string;
  role: string;
  facilityId?: string;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign(payload, secret, { expiresIn: "24h" });
}

export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    const decoded = verifyJwt(token);
    if (decoded.role !== "super_admin") {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }
    (req as AuthRequest).user = decoded;
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("expired")) {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    res.status(401).json({ error: "Invalid token" });
  }
}

export function generateSuperAdminToken(
  adminId: string,
  email: string,
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign({ id: adminId, email, role: "super_admin" }, secret, {
    expiresIn: "8h",
  });
}
