import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ── GET /api/transactions ────────────────────────────────────────────────────

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const {
    type,
    status,
    page = "1",
    limit = "20",
    search,
  } = req.query as Record<string, string>;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {
    OR: [{ senderId: userId }, { receiverId: userId }],
  };

  if (type && type !== "all") {
    where.type = type;
  }
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { description: { contains: search } },
      { reference: { contains: search } },
      { fromCurrency: { contains: search.toUpperCase() } },
    ];
    // Keep the user scope
    where.AND = [{ OR: [{ senderId: userId }, { receiverId: userId }] }];
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: where as any,
      orderBy: { createdAt: "desc" },
      skip,
      take: parseInt(limit),
    }),
    prisma.transaction.count({ where: where as any }),
  ]);

  // Aggregate stats
  const allUserTx = await prisma.transaction.findMany({
    where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    select: {
      type: true,
      status: true,
      fromAmount: true,
      fee: true,
      fromCurrency: true,
    },
  });

  const RATES: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    NGN: 1580,
    BTC: 0.000016,
    ETH: 0.00043,
    SOL: 0.0082,
    USDT: 1.0,
    MATIC: 1.42,
  };

  const totalVolume = allUserTx.reduce((sum, tx) => {
    const rate = RATES[tx.fromCurrency] || 1;
    return sum + tx.fromAmount / rate;
  }, 0);

  const totalFees = allUserTx.reduce((sum, tx) => {
    const rate = RATES[tx.fromCurrency] || 1;
    return sum + tx.fee / rate;
  }, 0);

  const completedCount = allUserTx.filter(
    (tx) => tx.status === "completed",
  ).length;

  return res.json({
    transactions,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
    stats: {
      totalTransactions: allUserTx.length,
      totalVolumeUSD: +totalVolume.toFixed(2),
      totalFeesUSD: +totalFees.toFixed(2),
      completedCount,
    },
  });
});

// ── GET /api/transactions/:id ────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const { id } = req.params;

  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      OR: [{ senderId: userId }, { receiverId: userId }],
    } as any,
  });

  if (!transaction) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.json({ transaction });
});

export default router;
