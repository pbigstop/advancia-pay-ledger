export enum AgentType {
  FRAUD_SHIELD = "FRAUD_SHIELD",
  PAYMENT_OPTIMIZER = "PAYMENT_OPTIMIZER",
  CONTENT_CREATOR = "CONTENT_CREATOR",
  REVENUE_ANALYST = "REVENUE_ANALYST",
  CHURN_PREDICTOR = "CHURN_PREDICTOR",
  COMPLIANCE_MONITOR = "COMPLIANCE_MONITOR",
  SUPPORT_HANDLER = "SUPPORT_HANDLER",
  EMAIL_COMPOSER = "EMAIL_COMPOSER",
}

export const FEATURE_NAMES: Record<AgentType, string> = {
  [AgentType.FRAUD_SHIELD]: "Security System",
  [AgentType.PAYMENT_OPTIMIZER]: "Smart Routing",
  [AgentType.CONTENT_CREATOR]: "Content Studio",
  [AgentType.REVENUE_ANALYST]: "Revenue Intelligence",
  [AgentType.CHURN_PREDICTOR]: "Retention Alerts",
  [AgentType.COMPLIANCE_MONITOR]: "Compliance Engine",
  [AgentType.SUPPORT_HANDLER]: "Support Center",
  [AgentType.EMAIL_COMPOSER]: "Message Center",
};

export interface AgentResult {
  success: boolean;
  output: any;
  error?: string;
  metadata: {
    duration: number;
    timestamp: string;
    model: string;
    featureName: string;
  };
}

export abstract class BaseAgent {
  abstract readonly type: AgentType;

  async execute(input: any, facilityId?: string): Promise<AgentResult> {
    const start = Date.now();
    try {
      const output = await this.run(input, facilityId);
      return {
        success: true,
        output,
        metadata: {
          duration: Date.now() - start,
          timestamp: new Date().toISOString(),
          model: "internal-ensemble-v2",
          featureName: FEATURE_NAMES[this.type],
        },
      };
    } catch (err: any) {
      console.error(`[Agent ${this.type}] Error:`, err);
      return {
        success: false,
        output: null,
        error: err.message,
        metadata: {
          duration: Date.now() - start,
          timestamp: new Date().toISOString(),
          model: "internal-ensemble-v2",
          featureName: FEATURE_NAMES[this.type],
        },
      };
    }
  }

  protected abstract run(input: any, facilityId?: string): Promise<any>;
}
