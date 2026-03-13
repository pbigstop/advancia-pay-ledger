import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// ── Exchange rates (USD base) ────────────────────────────────────────────────
const RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, NGN: 1580,
  BTC: 0.000016, ETH: 0.00043, SOL: 0.0082, USDT: 1.0, MATIC: 1.42,
};

const CRYPTO_CURRENCIES = ["BTC", "ETH", "SOL", "USDT", "MATIC"];

function toUSD(amount: number, currency: string): number {
  const rate = RATES[currency];
  if (!rate) return 0;
  return amount / rate;
}

// ── GET /api/wallet ──────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const walletsWithUSD = wallets.map((w) => ({
    ...w,
    usdValue: toUSD(w.balance, w.currency),
  }));

  const totalUSD = walletsWithUSD.reduce((sum, w) => sum + w.usdValue, 0);
  const fiatTotal = walletsWithUSD
    .filter((w) => w.type === "fiat")
    .reduce((sum, w) => sum + w.usdValue, 0);
  const cryptoTotal = walletsWithUSD
    .filter((w) => w.type === "crypto")
    .reduce((sum, w) => sum + w.usdValue, 0);

  return res.json({
    wallets: walletsWithUSD,
    summary: {
      totalUSD,
      fiatTotal,
      cryptoTotal,
      walletCount: wallets.length,
    },
  });
});

// ── POST /api/wallet/create ──────────────────────────────────────────────────

const CreateWalletSchema = z.object({
  currency: z.string().min(2).max(5),
});

router.post("/create", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const parsed = CreateWalletSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { currency } = parsed.data;
  const upperCurrency = currency.toUpperCase();

  if (!RATES[upperCurrency]) {
    return res.status(400).json({ error: `Unsupported currency: ${upperCurrency}` });
  }

  const existing = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: upperCurrency } },
  });

  if (existing) {
    return res.status(409).json({ error: `${upperCurrency} wallet already exists` });
  }

  const isCrypto = CRYPTO_CURRENCIES.includes(upperCurrency);
  const address = isCrypto
    ? "0x" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
    : null;

  const wallet = await prisma.wallet.create({
    data: {
      userId,
      currency: upperCurrency,
      balance: 0,
      type: isCrypto ? "crypto" : "fiat",
      address,
    },
  });

  return res.status(201).json({ wallet });
});

// ── POST /api/wallet/deposit ─────────────────────────────────────────────────

const DepositSchema = z.object({
  currency: z.string().min(2).max(5),
  amount: z.number().positive(),
  method: z.enum(["wire", "crypto", "card"]).optional(),
});

router.post("/deposit", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const parsed = DepositSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { currency, amount, method } = parsed.data;
  const upperCurrency = currency.toUpperCase();

  const feeRate = method === "card" ? 0.015 : 0;
  const fee = +(amount * feeRate).toFixed(8);
  const net = +(amount - fee).toFixed(8);

  const wallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency: upperCurrency } },
  });

  if (!wallet) {
    return res.status(404).json({ error: `No ${upperCurrency} wallet found. Create one first.` });
  }

  const reference = `DEP-${Date.now().toString(36).toUpperCase()}`;

  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: net } },
    }),
    prisma.transaction.create({
      data: {
        type: "deposit",
        status: "completed",
        fromCurrency: upperCurrency,
        fromAmount: net,
        fee,
        description: `Deposit via ${method ?? "wire"} — ${net} ${upperCurrency}`,
        reference,
        senderId: userId,
        walletId: wallet.id,
      },
    }),
  ]);

  return res.json({
    success: true,
    wallet: updatedWallet,
    transaction,
    reference,
  });
});

// ── GET /api/wallet/rates ────────────────────────────────────────────────────

router.get("/rates", (_req: Request, res: Response) => {
  return res.json({ rates: RATES, base: "USD" });
});

export default router;
