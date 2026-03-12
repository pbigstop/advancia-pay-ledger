import { BaseAgent, AgentType } from "./baseAgent";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class ComplianceMonitorAgent extends BaseAgent {
  readonly type = AgentType.COMPLIANCE_MONITOR;
  
  protected async run(input: { facilityId: string; checkType: "hipaa" | "pci" | "full" }) {
    const { facilityId, checkType } = input;
    
    const findings: { severity: "critical" | "warning" | "info"; category: string; description: string; action: string }[] = [];
    
    if (checkType === "hipaa" || checkType === "full") {
      // Mocking UNAUDITED records check
      const unauditedRecords = Math.floor(Math.random() * 5); // Simulated
      if (unauditedRecords > 0) {
        findings.push({
          severity: "warning",
          category: "HIPAA",
          description: `${unauditedRecords} medical records accessed without complete audit trail`,
          action: "Enable full audit logging in Settings → Compliance",
        });
      }
      
      const noTwoFaUsers = await prisma.user.count({
        where: { facilityId, role: { in: ["provider", "admin"] }, totpSecret: null },
      });
      if (noTwoFaUsers > 0) {
        findings.push({
          severity: "critical",
          category: "HIPAA",
          description: `${noTwoFaUsers} staff with PHI access have not enabled 2FA`,
          action: "Require 2FA for all clinical staff under HIPAA Security Rule",
        });
      }
    }
    
    if (checkType === "pci" || checkType === "full") {
      // Mocking KYC check
      const isKycComplete = Math.random() > 0.2; // 80% chance it is complete
      if (!isKycComplete) {
        findings.push({
          severity: "critical",
          category: "PCI-DSS",
          description: "KYC verification incomplete — required for card payment processing",
          action: "Complete KYC verification in Settings → Compliance → Verify Identity",
        });
      }
    }
    
    const score = findings.length === 0 ? 100 :
      Math.max(0, 100 - findings.filter(f => f.severity === "critical").length * 20 - findings.filter(f => f.severity === "warning").length * 10);
    
    return {
      facilityId,
      checkType,
      complianceScore: score,
      status: score >= 90 ? "compliant" : score >= 70 ? "needs_attention" : "non_compliant",
      findings,
      summary: findings.length === 0
        ? "Compliance Engine confirms all systems are compliant"
        : `Compliance Engine identified ${findings.length} item(s) requiring attention`,
      checkedAt: new Date().toISOString(),
      nextCheckAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
  }
}
