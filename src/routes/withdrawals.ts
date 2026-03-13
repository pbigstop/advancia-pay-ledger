import { Router, Request, Response } from "express";
import { z } from "zod";
import speakeasy from "speakeasy";
import { prisma } from "../lib/prisma";
import {
  executeWithdrawal,
  getExplorerUrl,
} from "../services/withdrawalService";
import { checkAML } from "../services/amlService";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

// ─── Validation Schema ───────────────────────────────────────────────────────

const WithdrawSchema = z.object({
  facilityId: z.string().min(1),
  chain: z.enum(["solana", "ethereum", "polygon", "base"]),
  token: z.enum(["SOL", "ETH", "MATIC", "USDC", "USDT"]),
  toAddress: z.string().min(10),
  amount: z.number().positive().max(100_000),
  totpCode: z.string().length(6),
  note: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getDailyTotal(facilityId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await prisma.cryptoWithdrawal.aggregate({
    where: { facilityId, status: "COMPLETED", createdAt: { gte: startOfDay } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });
}

// ─── POST /api/withdrawals/crypto ────────────────────────────────────────────

router.post(
  "/crypto",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const parsed = WithdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { facilityId, chain, token, toAddress, amount, totpCode, note } =
      parsed.data;
    const adminId: string = (req as AuthRequest).user!.id;

    // Verify 2FA
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { totpSecret: true },
    });
    if (!admin?.totpSecret) {
      return res
        .status(403)
        .json({ error: "2FA not configured. Set up authenticator first." });
    }
    if (!verifyTOTP(admin.totpSecret, totpCode)) {
      return res.status(403).json({ error: "Invalid 2FA code" });
    }

    // Verify AML
    try {
      const amlResult = await checkAML(toAddress, chain);
      if (amlResult.risk === "HIGH") {
        return res
          .status(403)
          .json({ error: "Address flagged by AML screening" });
      }
    } catch (err: unknown) {
      console.error("[AML] Error checking address:", err);
      return res.status(500).json({ error: "AML screening failed" });
    }

    // Daily limit check
    const DAILY_LIMIT = Number(
      process.env.WITHDRAWAL_DAILY_LIMIT_USD ?? 50_000,
    );
    const todayTotal = await getDailyTotal(facilityId);
    if (todayTotal + amount > DAILY_LIMIT) {
      return res.status(429).json({
        error: "Daily limit exceeded",
        remaining: DAILY_LIMIT - todayTotal,
        limit: DAILY_LIMIT,
      });
    }

    // Execute on-chain
    try {
      const { txHash, explorerUrl } = await executeWithdrawal({
        facilityId,
        chain,
        token,
        toAddress,
        amount,
        initiatedBy: adminId,
        note,
      });

      return res.status(200).json({
        success: true,
        txHash,
        explorerUrl,
        chain,
        token,
        amount,
        toAddress,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[WithdrawalRoute] Error:", message);
      return res
        .status(500)
        .json({ error: "Transaction failed", detail: message });
    }
  },
);

// ─── GET /api/withdrawals/history ────────────────────────────────────────────

router.get(
  "/history",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const {
      facilityId,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = facilityId ? { facilityId } : {};

    const [withdrawals, total] = await Promise.all([
      prisma.cryptoWithdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.cryptoWithdrawal.count({ where }),
    ]);

    return res.json({
      withdrawals: withdrawals.map((w) => ({
        ...w,
        explorerUrl: w.txHash ? getExplorerUrl(w.chain, w.txHash) : null,
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  },
);

// ─── GET /api/withdrawals/daily-summary ──────────────────────────────────────

router.get(
  "/daily-summary",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { facilityId } = req.query as { facilityId: string };
    if (!facilityId)
      return res.status(400).json({ error: "facilityId required" });

    const DAILY_LIMIT = Number(
      process.env.WITHDRAWAL_DAILY_LIMIT_USD ?? 50_000,
    );
    const used = await getDailyTotal(facilityId);

    return res.json({
      used,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT - used,
      percent: Math.round((used / DAILY_LIMIT) * 100),
    });
  },
);

export default router;
