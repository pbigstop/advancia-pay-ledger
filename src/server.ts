import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

dotenv.config();

import { initRedis } from "./lib/redis";
import authRoutes from "./routes/auth";
import walletRoutes from "./routes/wallet";
import exchangeRoutes from "./routes/exchange";
import transferRoutes from "./routes/transfer";
import transactionRoutes from "./routes/transactions";
import withdrawalRoutes from "./routes/withdrawals";
import billingRoutes from "./routes/billing";
import liveStreamRoutes from "./routes/admin/live-stream";
import featuresRoutes from "./routes/features";
import emailRoutes from "./routes/email";
import { responseSanitizer } from "./middleware/responseSanitizer";
import { startScheduler } from "./jobs/scheduler";

const app = express();
const PORT = Number(process.env.BANKING_PORT) || 3005;

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — try again in 15 minutes" },
});
app.use(limiter);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(responseSanitizer);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "advancia-banking",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/exchange", exchangeRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/admin", liveStreamRoutes);
app.use("/api/features", featuresRoutes);
app.use("/api/email", emailRoutes);

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Error Handler ────────────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[Server Error]", err.message);
    res.status(500).json({ error: "Internal server error" });
  },
);

// ── Start ────────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    await initRedis();
    startScheduler();
  } catch (err) {
    console.warn(
      "[Redis] Not initialized:",
      err instanceof Error ? err.message : String(err),
    );
  }

  app.listen(PORT, () => {
    const baseUrl =
      process.env.APP_BASE_URL || process.env.FRONTEND_URL || `port ${PORT}`;
    console.log(`\n  🏦 Advancia Banking API running`);
    console.log(`  🌐 Base:   ${baseUrl}`);
    console.log(`  📋 Health: /health`);
    console.log(`  🔐 Auth:   /api/auth/login`);
    console.log(`  💰 Wallet: /api/wallet`);
    console.log(`  ⇄  Exchange: /api/exchange`);
    console.log(`  →  Transfer: /api/transfer`);
    console.log(`  📜 History: /api/transactions`);
    console.log(`  💳 Billing: /api/billing/status/:userId`);
    console.log(`  📡 Admin:   /api/admin/stream\n`);
  });
}

void start();

export default app;
