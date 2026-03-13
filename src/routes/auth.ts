import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateToken, requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ── Validation Schemas ───────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["admin", "cfo", "provider", "patient"]).optional(),
  facilityId: z.string().optional(),
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    facilityId: user.facilityId ?? undefined,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      facilityId: user.facilityId,
    },
  });
});

// ── POST /api/auth/register ──────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password, firstName, lastName, role, facilityId } =
    parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashed,
      firstName,
      lastName,
      role: role ?? "patient",
      facilityId,
    },
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    facilityId: user.facilityId ?? undefined,
  });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      facilityId: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ user });
});

// ── POST /api/auth/verify-pin ────────────────────────────────────────────────

router.post("/verify-pin", requireAuth, async (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: "PIN required" });
  }

  // Note: For actual production, a user-specific PIN or shared admin PIN
  // needs to be correctly verified against the DB (hashed).
  // Mock verification logic here.
  const adminPinHash = process.env.ADMIN_PIN_HASH;
  if (!adminPinHash) {
    // Development fallback
    if (pin === "2025Adv!") return res.json({ success: true });
    return res.status(401).json({ error: "Invalid PIN" });
  }

  const valid = await bcrypt.compare(pin, adminPinHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid PIN" });
  }

  return res.json({ success: true });
});

export default router;
