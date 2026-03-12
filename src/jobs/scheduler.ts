import cron from "node-cron";
import { orchestrator, AgentType } from "../agents/orchestrator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function startScheduler() {
  console.log("[Platform] Starting automated feature scheduler...");

  // ── Every 5 minutes: Security System scan ──────────────────────────────────
  cron.schedule("*/5 * * * *", async () => {
    console.log("[Security System] Running scheduled scan...");
    const facilities = (await prisma.user.findMany({
      where: { facilityId: { not: null } },
      select: { facilityId: true },
      distinct: ["facilityId"]
    })).map(u => ({ id: u.facilityId! }));

    for (const f of facilities.slice(0, 10)) { 
      const recentPayments = await prisma.transaction.findMany({
        where: { senderId: f.id, createdAt: { gte: new Date(Date.now() - 5 * 60000) } },
        select: { id: true, fromAmount: true, type: true },
      });
      for (const p of recentPayments) {
        await orchestrator.run(AgentType.FRAUD_SHIELD, {
          paymentId: p.id, amount: p.fromAmount, method: p.type, facilityId: f.id,
        }, f.id);
      }
    }
  });

  // ── Every 30 minutes: Compliance Engine ────────────────────────────────────
  cron.schedule("*/30 * * * *", async () => {
    console.log("[Compliance Engine] Running 30-minute check...");
    const facilities = (await prisma.user.findMany({
      where: { facilityId: { not: null } },
      select: { facilityId: true },
      distinct: ["facilityId"]
    })).map(u => ({ id: u.facilityId! }));

    for (const f of facilities) {
      await orchestrator.run(AgentType.COMPLIANCE_MONITOR, { facilityId: f.id, checkType: "pci" }, f.id);
    }
  });

  // ── Daily 6 AM: Full compliance + revenue reports ──────────────────────────
  cron.schedule("0 6 * * *", async () => {
    console.log("[Platform] Running daily automated features...");
    await orchestrator.runDailyChecks();
    
    const facilities = (await prisma.user.findMany({
      where: { facilityId: { not: null } },
      select: { facilityId: true },
      distinct: ["facilityId"]
    })).map(u => ({ id: u.facilityId! }));

    for (const f of facilities) {
      await orchestrator.run(AgentType.REVENUE_ANALYST, { facilityId: f.id, period: "month" }, f.id);
    }
  });

  // ── Weekly Monday 8 AM: Retention Alerts ───────────────────────────────────
  cron.schedule("0 8 * * 1", async () => {
    console.log("[Retention Alerts] Running weekly facility health check...");
    const result = await orchestrator.run(AgentType.CHURN_PREDICTOR, { lookbackDays: 30 });
    
    if (result.success && result.output.atRiskCount > 0) {
      const admins = await prisma.user.findMany({ where: { role: "super_admin" } });
      // In production we would create a Notification record or send an email here.
      console.log(`[Retention Alerts] ${result.output.atRiskCount} Facilities Need Attention`);
    }
  });

  console.log("[Platform] Scheduler active: Security(5min) · Compliance(30min) · Revenue(daily) · Retention(weekly)");
}
