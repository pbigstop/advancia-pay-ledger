import { BaseAgent, AgentType } from "./baseAgent";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class FraudShieldAgent extends BaseAgent {
  readonly type = AgentType.FRAUD_SHIELD;

  protected async run(input: { paymentId: string; amount: number; method: string; ipAddress?: string }, facilityId?: string) {
    const { amount, method, ipAddress } = input;
    
    let riskScore = 0;
    const flags: string[] = [];

    // Simple heuristic rule checks
    if (amount > 10000) {
      riskScore += 30;
      flags.push("High transaction amount");
    }

    if (method.startsWith("CRYPTO_") && amount > 5000) {
      riskScore += 25;
      flags.push("High crypto transfer amount");
    }

    // IP velocity simulation
    if (ipAddress) {
      const recentFromIp = await prisma.transaction.count({
        where: { createdAt: { gte: new Date(Date.now() - 3600000) } } // Mock checking by IP logic
      });
      if (recentFromIp > 10) {
        riskScore += 40;
        flags.push("High velocity from IP");
      }
    }

    // Add noise to score for simulation
    riskScore += Math.floor(Math.random() * 15);
    riskScore = Math.min(riskScore, 100);

    let action: "block" | "review" | "clear" = "clear";
    if (riskScore >= 70) action = "block";
    else if (riskScore >= 40) action = "review";

    return {
      riskScore,
      flags,
      action,
      timestamp: new Date().toISOString(),
    };
  }
}
