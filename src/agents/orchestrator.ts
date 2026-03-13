import { BaseAgent, AgentType, AgentResult } from "./baseAgent";
import { FraudShieldAgent } from "./fraudShieldAgent";
import { PaymentOptimizerAgent } from "./paymentOptimizerAgent";
import { ContentCreatorAgent } from "./contentCreatorAgent";
import { RevenueAnalystAgent } from "./revenueAnalystAgent";
import { ChurnPredictorAgent } from "./churnPredictorAgent";
import { ComplianceMonitorAgent } from "./complianceMonitorAgent";
import { SupportHandlerAgent } from "./supportHandlerAgent";
import { EmailComposerAgent } from "./emailComposerAgent";
import { prisma } from "../lib/prisma";

export class AgentOrchestrator {
  private agents: Record<AgentType, BaseAgent> = {
    [AgentType.FRAUD_SHIELD]: new FraudShieldAgent(),
    [AgentType.PAYMENT_OPTIMIZER]: new PaymentOptimizerAgent(),
    [AgentType.CONTENT_CREATOR]: new ContentCreatorAgent(),
    [AgentType.REVENUE_ANALYST]: new RevenueAnalystAgent(),
    [AgentType.CHURN_PREDICTOR]: new ChurnPredictorAgent(),
    [AgentType.COMPLIANCE_MONITOR]: new ComplianceMonitorAgent(),
    [AgentType.SUPPORT_HANDLER]: new SupportHandlerAgent(),
    [AgentType.EMAIL_COMPOSER]: new EmailComposerAgent(),
  };

  async run(
    agentType: AgentType,
    input: any,
    facilityId?: string,
  ): Promise<AgentResult> {
    const agent = this.agents[agentType];
    if (!agent) throw new Error(`Unknown agent type: ${agentType}`);
    return agent.execute(input, facilityId);
  }

  // Run multiple agents in parallel
  async runParallel(
    tasks: { type: AgentType; input: any; facilityId?: string }[],
  ): Promise<AgentResult[]> {
    return Promise.all(
      tasks.map((t) => this.run(t.type, t.input, t.facilityId)),
    );
  }

  // Scheduled jobs (cron)
  async runDailyChecks() {
    console.log("[Platform] Running daily automated checks...");

    // Compliance check for all active facilities
    const facilities = (
      await prisma.user.findMany({
        where: { facilityId: { not: null } },
        select: { facilityId: true },
        distinct: ["facilityId"],
      })
    ).map((u) => ({ id: u.facilityId! }));

    for (const f of facilities) {
      await this.run(
        AgentType.COMPLIANCE_MONITOR,
        { facilityId: f.id, checkType: "full" },
        f.id,
      );
    }

    // Churn prediction
    await this.run(AgentType.CHURN_PREDICTOR, { lookbackDays: 30 });

    console.log("[Platform] Daily checks complete.");
  }
}

export const orchestrator = new AgentOrchestrator();
export { AgentType, FEATURE_NAMES } from "./baseAgent";
