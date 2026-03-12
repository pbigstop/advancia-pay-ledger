import { BaseAgent, AgentType } from "./baseAgent";

export class PaymentOptimizerAgent extends BaseAgent {
  readonly type = AgentType.PAYMENT_OPTIMIZER;
  
  protected async run(input: { amount: number; urgency: "fast" | "cheap" | "balanced" }) {
    const { amount, urgency } = input;
    
    // Network cost/speed matrix (fetched live in production)
    const networks = [
      { name: "SOLANA",   confirmMs: 400,   feeUSD: 0.00025, reliability: 0.997 },
      { name: "POLYGON",  confirmMs: 2000,  feeUSD: 0.01,    reliability: 0.995 },
      { name: "BASE",     confirmMs: 2000,  feeUSD: 0.01,    reliability: 0.994 },
      { name: "ETHEREUM", confirmMs: 12000, feeUSD: 3.50,    reliability: 0.999 },
    ];
    
    // Score each network by urgency preference
    const scored = networks.map(n => {
      let score = 0;
      if (urgency === "fast")     score = (1 / n.confirmMs) * 1000000 + n.reliability * 50;
      if (urgency === "cheap")    score = (1 / n.feeUSD) + n.reliability * 50;
      if (urgency === "balanced") score = (1 / n.confirmMs) * 500000 + (1 / n.feeUSD) * 0.5 + n.reliability * 50;
      return { ...n, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    const recommended = scored[0];
    
    return {
      recommended: recommended.name,
      estimatedFee: recommended.feeUSD,
      estimatedConfirmMs: recommended.confirmMs,
      savingsVsCard: (amount * 0.029) - recommended.feeUSD,
      reason: urgency === "fast"
        ? `Selected for fastest confirmation (~${recommended.confirmMs}ms)` 
        : urgency === "cheap"
        ? `Selected for lowest fee ($${recommended.feeUSD.toFixed(5)})` 
        : `Optimal balance of speed and cost`,
      alternatives: scored.slice(1, 3).map(n => ({ name: n.name, fee: n.feeUSD })),
    };
  }
}
