import { BaseAgent, AgentType } from "./baseAgent";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class RevenueAnalystAgent extends BaseAgent {
  readonly type = AgentType.REVENUE_ANALYST;
  
  protected async run(input: { facilityId: string; period: "week" | "month" | "quarter" }) {
    const { facilityId, period } = input;
    
    const days = period === "week" ? 7 : period === "month" ? 30 : 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
    
    const [current, previous] = await Promise.all([
      prisma.transaction.aggregate({
        where: { senderId: facilityId, status: "completed", createdAt: { gte: since } },
        _sum: { fromAmount: true }, _count: true, _avg: { fromAmount: true },
      }),
      prisma.transaction.aggregate({
        where: { senderId: facilityId, status: "completed", createdAt: { gte: prevSince, lt: since } },
        _sum: { fromAmount: true }, _count: true,
      }),
    ]);
    
    const currentRevenue = current._sum.fromAmount || 0;
    const prevRevenue = previous._sum.fromAmount || 0;
    const growth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    
    // Simulate crypto revenue query
    const cryptoRevenue = await prisma.transaction.aggregate({
      where: { senderId: facilityId, status: "completed", type: "crypto", createdAt: { gte: since } },
      _sum: { fromAmount: true },
    });
    
    const insights: string[] = [];
    
    if (growth > 20) insights.push(`Revenue grew ${growth.toFixed(0)}% vs previous ${period} — exceptional performance`);
    else if (growth > 0) insights.push(`Revenue up ${growth.toFixed(0)}% vs previous ${period}`);
    else insights.push(`Revenue is ${Math.abs(growth).toFixed(0)}% below previous ${period} — review needed`);
    
    const cryptoPct = currentRevenue > 0 ? ((cryptoRevenue._sum.fromAmount || 0) / currentRevenue * 100) : 0;
    if (cryptoPct > 50) insights.push(`${cryptoPct.toFixed(0)}% of revenue from crypto — strong adoption`);
    
    const avg = current._avg.fromAmount || 0;
    if (avg > 500) insights.push(`Average transaction $${avg.toFixed(0)} — high-value patients`);
    
    return {
      period,
      revenue: {
        current: currentRevenue,
        previous: prevRevenue,
        growth: growth.toFixed(1),
        trend: growth > 0 ? "up" : growth < 0 ? "down" : "flat",
      },
      transactions: { current: current._count, previous: previous._count },
      averageTransaction: avg.toFixed(2),
      cryptoShare: cryptoPct.toFixed(1),
      insights,
      generatedBy: "Revenue Intelligence",
      reportDate: new Date().toISOString(),
    };
  }
}
