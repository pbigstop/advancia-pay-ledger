import express from "express";
import { orchestrator, AgentType, FEATURE_NAMES } from "../agents/orchestrator";
import { requireAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { z } from "zod";

const router = express.Router();
router.use(requireAuth);

// ── Security System (Fraud Shield) ───────────────────────────────────────────
router.post("/security/analyze", requireAdmin, async (req, res) => {
  const { paymentId, amount, method } = req.body;
  const facilityId = (req as AuthRequest).user!.facilityId;
  
  const result = await orchestrator.run(AgentType.FRAUD_SHIELD, {
    paymentId, amount, method, facilityId, ipAddress: req.ip,
  }, facilityId);
  
  if (!result.success) return res.status(500).json({ error: "Security system unavailable" });
  
  const { riskScore, flags, action } = result.output;
  res.json({
    status: action,
    riskLevel: riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low",
    processedBy: FEATURE_NAMES[AgentType.FRAUD_SHIELD],
    recommendation: action === "block"
      ? "Transaction blocked by security system. Review in Payments → Flagged."
      : action === "review"
      ? "Transaction flagged for manual review."
      : "Transaction cleared.",
  });
});

// ── Smart Routing (Payment Optimizer) ────────────────────────────────────────
router.post("/payments/recommend-network", async (req, res) => {
  const { amount, urgency = "balanced" } = req.body;
  
  const result = await orchestrator.run(AgentType.PAYMENT_OPTIMIZER, { amount, urgency });
  if (!result.success) return res.status(500).json({ error: "Smart routing unavailable" });
  
  res.json({
    ...result.output,
    processedBy: FEATURE_NAMES[AgentType.PAYMENT_OPTIMIZER],
  });
});

// ── Content Studio (Content Creator) ─────────────────────────────────────────
router.post("/content/generate", requireAdmin, async (req, res) => {
  const schema = z.object({
    type: z.enum(["social_post", "email_campaign", "blog_post", "press_release", "patient_notice", "payment_announcement"]),
    topic: z.string().min(10).max(500),
    tone: z.enum(["professional", "friendly", "urgent", "celebratory"]).default("professional"),
    targetAudience: z.enum(["patients", "staff", "investors", "public"]).default("patients"),
    keywords: z.array(z.string()).optional(),
    wordCount: z.number().min(50).max(1000).optional(),
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  
  const { facilityId } = (req as AuthRequest).user!;
  
  const result = await orchestrator.run(AgentType.CONTENT_CREATOR, {
    ...parsed.data,
    facilityName: `Facility ${facilityId}`, 
  }, facilityId);
  
  if (!result.success) return res.status(500).json({ error: "Content Studio unavailable" });
  
  res.json({
    content: result.output.content,
    type: result.output.type,
    generatedBy: FEATURE_NAMES[AgentType.CONTENT_CREATOR],
    platform: "advancia-healthcare.com",
    disclaimer: "Review and customize content before publishing.",
  });
});

// ── Revenue Intelligence (Revenue Analyst) ────────────────────────────────────
router.get("/insights/revenue", requireAdmin, async (req, res) => {
  const facilityId = (req as AuthRequest).user!.facilityId;
  if (!facilityId) return res.status(400).json({ error: "facilityId required" });
  const period = (req.query.period as "week" | "month" | "quarter") || "month";
  
  const result = await orchestrator.run(AgentType.REVENUE_ANALYST, { facilityId, period }, facilityId);
  if (!result.success) return res.status(500).json({ error: "Revenue Intelligence unavailable" });
  
  res.json({
    ...result.output,
    processedBy: FEATURE_NAMES[AgentType.REVENUE_ANALYST],
  });
});

// ── Retention Alerts (Churn Predictor) ───────────────────────────────────────
router.get("/insights/retention", requireAdmin, async (req, res) => {
  const result = await orchestrator.run(AgentType.CHURN_PREDICTOR, { lookbackDays: 30 });
  if (!result.success) return res.status(500).json({ error: "Retention Alerts unavailable" });
  
  res.json({
    ...result.output,
    processedBy: FEATURE_NAMES[AgentType.CHURN_PREDICTOR],
  });
});

// ── Compliance Engine (Compliance Monitor) ────────────────────────────────────
router.post("/compliance/check", requireAdmin, async (req, res) => {
  const facilityId = (req as AuthRequest).user!.facilityId;
  if (!facilityId) return res.status(400).json({ error: "facilityId required" });
  const checkType = req.body.checkType || "full";
  
  const result = await orchestrator.run(AgentType.COMPLIANCE_MONITOR, { facilityId, checkType }, facilityId);
  if (!result.success) return res.status(500).json({ error: "Compliance Engine unavailable" });
  
  res.json({
    ...result.output,
    processedBy: FEATURE_NAMES[AgentType.COMPLIANCE_MONITOR],
  });
});

// ── Support Center (Support Handler) ─────────────────────────────────────────
router.post("/support/ask", async (req, res) => {
  const { category, question } = req.body;
  const user = (req as AuthRequest).user!;
  
  const result = await orchestrator.run(AgentType.SUPPORT_HANDLER, {
    facilityId: user.facilityId, userId: user.id, category, question,
  }, user.facilityId);
  
  if (!result.success) return res.status(500).json({ error: "Support Center unavailable" });
  
  res.json({
    answer: result.output.answer,
    escalated: result.output.escalatedToHuman,
    escalationNote: result.output.escalationNote,
    supportEmail: result.output.supportEmail,
    respondedBy: FEATURE_NAMES[AgentType.SUPPORT_HANDLER],
  });
});

// ── Message Center (Email Composer) ──────────────────────────────────────────
router.post("/messages/draft", requireAdmin, async (req, res) => {
  const { purpose, recipientType, customData } = req.body;
  const facilityId = (req as AuthRequest).user!.facilityId;
  if (!facilityId) return res.status(400).json({ error: "facilityId required" });
  
  const result = await orchestrator.run(AgentType.EMAIL_COMPOSER, {
    facilityId, purpose, recipientType, customData,
  }, facilityId);
  
  if (!result.success) return res.status(500).json({ error: "Message Center unavailable" });
  
  res.json({
    ...result.output,
    processedBy: FEATURE_NAMES[AgentType.EMAIL_COMPOSER],
  });
});

// ── Platform Features Overview ───────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { role } = (req as AuthRequest).user!;
  
  const features = [
    {
      id: "security",
      name: "Security System",
      description: "Real-time transaction monitoring and fraud prevention",
      endpoint: "/api/features/security/analyze",
      roles: ["admin", "cfo", "super_admin"],
    },
    {
      id: "smart-routing",
      name: "Smart Routing",
      description: "Automatically selects the optimal payment network for lowest fees",
      endpoint: "/api/features/payments/recommend-network",
      roles: ["admin", "cfo", "provider", "super_admin", "patient"],
    },
    {
      id: "content-studio",
      name: "Content Studio",
      description: "Generate professional healthcare content: social posts, emails, announcements",
      endpoint: "/api/features/content/generate",
      roles: ["admin", "super_admin"],
    },
    {
      id: "revenue-intelligence",
      name: "Revenue Intelligence",
      description: "Smart analysis of your payment trends and revenue performance",
      endpoint: "/api/features/insights/revenue",
      roles: ["admin", "cfo", "super_admin"],
    },
    {
      id: "compliance-engine",
      name: "Compliance Engine",
      description: "Automated HIPAA and PCI-DSS compliance verification",
      endpoint: "/api/features/compliance/check",
      roles: ["admin", "super_admin"],
    },
    {
      id: "support-center",
      name: "Support Center",
      description: "24/7 intelligent support for payment and platform questions",
      endpoint: "/api/features/support/ask",
      roles: ["admin", "cfo", "provider", "super_admin", "patient"],
    },
    {
      id: "message-center",
      name: "Message Center",
      description: "Smart email drafts for patient communications and announcements",
      endpoint: "/api/features/messages/draft",
      roles: ["admin", "super_admin"],
    },
  ];
  
  const userFeatures = features.filter(f => f.roles.includes(role));
  
  res.json({
    features: userFeatures,
    count: userFeatures.length,
    platform: "advancia-healthcare.com",
  });
});

export default router;
