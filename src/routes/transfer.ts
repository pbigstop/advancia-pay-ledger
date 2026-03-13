import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const TRANSFER_FEE_RATE = 0.005; // 0.5%
const MIN_FEE = 0.01;

// ── Validation ───────────────────────────────────────────────────────────────

const TransferSchema = z.object({
  fromCurrency: z.string().min(2).max(5),
  toRecipient: z.string().min(3),
  amount: z.number().positive(),
  note: z.string().optional(),
});

// ── POST /api/transfer ───────────────────────────────────────────────────────

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.id;
  const parsed = TransferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { fromCurrency, toRecipient, amount, note } = parsed.data;
  const currency = fromCurrency.toUpperCase();

  // Calculate fee
  const fee = +Math.max(amount * TRANSFER_FEE_RATE, MIN_FEE).toFixed(8);
  const totalDebit = +(amount + fee).toFixed(8);

  // Find sender's wallet
  const senderWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId, currency } },
  });

  if (!senderWallet) {
    return res.status(404).json({ error: `No ${currency} wallet found` });
  }

  if (senderWallet.balance < totalDebit) {
    return res.status(400).json({
      error: "Insufficient balance",
      available: senderWallet.balance,
      required: totalDebit,
    });
  }

  // Find recipient by email or address
  let recipientUser = await prisma.user.findUnique({ where: { email: toRecipient.toLowerCase() } });

  // If not found by email, check if any wallet has this address
  if (!recipientUser) {
    const recipientWallet = await prisma.wallet.findFirst({
      where: { address: toRecipient },
      include: { user: true },
    });
    if (recipientWallet) {
      recipientUser = recipientWallet.user;
    }
  }

  const reference = `TXN-${Date.now().toString(36).toUpperCase()}`;

  if (recipientUser) {
    // Internal transfer — credit recipient
    let recipientWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: recipientUser.id, currency } },
    });

    const CRYPTO = ["BTC", "ETH", "SOL", "USDT", "MATIC"];
    if (!recipientWallet) {
      recipientWallet = await prisma.wallet.create({
        data: {
          userId: recipientUser.id,
          currency,
          balance: 0,
          type: CRYPTO.includes(currency) ? "crypto" : "fiat",
          address: CRYPTO.includes(currency)
            ? "0x" + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
            : null,
        },
      });
    }

    const [updatedSender, updatedRecipient, transaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: totalDebit } },
      }),
      prisma.wallet.update({
        where: { id: recipientWallet.id },
        data: { balance: { increment: amount } },
      }),
      prisma.transaction.create({
        data: {
          type: "transfer",
          status: "completed",
          fromCurrency: currency,
          toCurrency: currency,
          fromAmount: amount,
          toAmount: amount,
          fee,
          description: `Transfer to ${toRecipient}`,
          reference,
          senderId: userId,
          receiverId: recipientUser.id,
          walletId: senderWallet.id,
          note,
        },
      }),
    ]);

    return res.json({
      success: true,
      reference,
      amount,
      fee,
      totalDebit,
      recipient: toRecipient,
      senderBalance: updatedSender.balance,
    });
  } else {
    // External transfer — debit only (recipient off-platform)
    const [updatedSender, transaction] = await prisma.$transaction([
      prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: totalDebit } },
      }),
      prisma.transaction.create({
        data: {
          type: "transfer",
          status: "completed",
          fromCurrency: currency,
          toCurrency: currency,
          fromAmount: amount,
          toAmount: amount,
          fee,
          description: `External transfer to ${toRecipient}`,
          reference,
          senderId: userId,
          walletId: senderWallet.id,
          note,
        },
      }),
    ]);

    return res.json({
      success: true,
      reference,
      amount,
      fee,
      totalDebit,
      recipient: toRecipient,
      senderBalance: updatedSender.balance,
      external: true,
    });
  }
});

// ── GET /api/transfer/fees ───────────────────────────────────────────────────

router.get("/fees", (_req: Request, res: Response) => {
  return res.json({
    transferFeeRate: TRANSFER_FEE_RATE,
    minimumFee: MIN_FEE,
    description: "0.5% fee on all transfers, minimum $0.01",
  });
});

export default router;
