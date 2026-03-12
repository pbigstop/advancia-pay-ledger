import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// ── Exchange rates (USD base) ────────────────────────────────────────────────
const RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, NGN: 1580,
  BTC: 0.000016, ETH: 0.00043, SOL: 0.0082, USDT: 1.0, MATIC: 1.42,
};

function getRate(from: string, to: string): number {
  return (RATES[to] / RATES[from]) * (1 + 0.001 * (Math.random() * 2 - 1));
}

function getFeeRate(usdAmount: number): number {
  if (usdAmount < 100) return 0.025;
  if (usdAmount < 1000) return 0.018;
  if (usdAmount < 10000) return 0.012;
  return 0.008;
}

// ── Validation ───────────────────────────────────────────────────────────────

const ExchangeSchema = z.object({
  action: z.enum(["quote", "execute"]),
  fromCurrency: z.string().min(2).max(5),
  toCurrency: z.string().min(2).max(5),
  fromAmount: z.number().positive(),
  quoteId: z.string().optional(),
});

// ── In-memory quote cache (production: use Redis) ────────────────────────────
const quoteCache = new Map<string, { from: string; to: string; fromAmount: number; toAmount: number; rate: number; fee: number; feeRate: number; expiresAt: number }>();

// ── POST /api/exchange ───────────────────────────────────────────────────────

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const parsed = ExchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { action, fromCurrency, toCurrency, fromAmount, quoteId } = parsed.data;
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (!RATES[from] || !RATES[to]) {
    return res.status(400).json({ error: "Unsupported currency pair" });
  }
  if (from === to) {
    return res.status(400).json({ error: "Cannot exchange same currency" });
  }

  // ── QUOTE ──────────────────────────────────────────────────────────────
  if (action === "quote") {
    const rate = getRate(from, to);
    const rawTo = fromAmount * rate;
    const usdValue = fromAmount / RATES[from];
    const feeRate = getFeeRate(usdValue);
    const fee = rawTo * feeRate;
    const toAmount = rawTo - fee;

    const id = `Q-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6)}`;
    quoteCache.set(id, { from, to, fromAmount, toAmount, rate, fee, feeRate, expiresAt: Date.now() + 30_000 });

    // Auto-expire after 35 seconds
    setTimeout(() => quoteCache.delete(id), 35_000);

    return res.json({
      quoteId: id,
      fromCurrency: from,
      toCurrency: to,
      fromAmount,
      toAmount: +toAmount.toFixed(8),
      rate: +rate.toFixed(8),
      fee: +fee.toFixed(8),
      feePercent: +(feeRate * 100).toFixed(1),
      expiresIn: 30,
    });
  }

  // ── EXECUTE ────────────────────────────────────────────────────────────
  if (action === "execute") {
    if (!quoteId) {
      return res.status(400).json({ error: "quoteId required for execution" });
    }

    const quote = quoteCache.get(quoteId);
    if (!quote) {
      return res.status(400).json({ error: "Quote expired or not found — request a new quote" });
    }
    if (Date.now() > quote.expiresAt) {
      quoteCache.delete(quoteId);
      return res.status(400).json({ error: "Quote expired — request a new quote" });
    }

    // Check source wallet balance
    const fromWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency: quote.from } },
    });
    if (!fromWallet || fromWallet.balance < quote.fromAmount) {
      return res.status(400).json({ error: `Insufficient ${quote.from} balance` });
    }

    // Ensure destination wallet exists (auto-create if not)
    let toWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency: quote.to } },
    });
    const CRYPTO = ["BTC", "ETH", "SOL", "USDT", "MATIC"];
    if (!toWallet) {
      toWallet = await prisma.wallet.create({
        data: {
          userId,
          currency: quote.to,
          balance: 0,
          type: CRYPTO.includes(quote.to) ? "crypto" : "fiat",
          address: CRYPTO.includes(quote.to)
            ? "0x" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
            : null,
        },
      });
    }

    const reference = `EXC-${Date.now().toString(36).toUpperCase()}`;

    const [updatedFrom, updatedTo, transaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: fromWallet.id },
        data: { balance: { decrement: quote.fromAmount } },
      }),
      prisma.wallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: quote.toAmount } },
      }),
      prisma.transaction.create({
        data: {
          type: "exchange",
          status: "completed",
          fromCurrency: quote.from,
          toCurrency: quote.to,
          fromAmount: quote.fromAmount,
          toAmount: quote.toAmount,
          fee: quote.fee,
          description: `Exchange ${quote.fromAmount} ${quote.from} → ${quote.toAmount.toFixed(8)} ${quote.to}`,
          reference,
          senderId: userId,
          walletId: fromWallet.id,
        },
      }),
    ]);

    quoteCache.delete(quoteId);

    return res.json({
      success: true,
      reference,
      fromWallet: updatedFrom,
      toWallet: updatedTo,
      transaction,
    });
  }

  return res.status(400).json({ error: "Invalid action" });
});

// ── GET /api/exchange/rates ──────────────────────────────────────────────────

router.get("/rates", (_req: Request, res: Response) => {
  const pairs = Object.entries(RATES)
    .filter(([k]) => k !== "USD")
    .map(([currency, rate]) => ({
      currency,
      rate,
      change: +(Math.random() * 6 - 2).toFixed(2),
    }));

  return res.json({ base: "USD", pairs });
});

export default router;
