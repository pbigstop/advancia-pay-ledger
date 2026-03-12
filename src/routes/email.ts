import express, { Request, Response } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { 
  sendEmail, 
  generateWelcomeEmail, 
  generateInvoiceEmail, 
  generateSecurityAlertEmail 
} from "../services/emailService";

const router = express.Router();

// ── POST /api/email/send-welcome ─────────────────────────────────────────────
router.post("/send-welcome", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { to, firstName, facilityName, loginUrl, verifyUrl } = req.body;
  
  if (!to || !firstName || !facilityName || !loginUrl) {
    return res.status(400).json({ error: "Missing required fields for welcome email" });
  }

  const emailData = generateWelcomeEmail({ firstName, facilityName, loginUrl, verifyUrl });
  await sendEmail(to, emailData.subject, emailData.html);
  
  res.json({ success: true, message: "Welcome email sent" });
});

// ── POST /api/email/send-invoice ─────────────────────────────────────────────
router.post("/send-invoice", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { to, patientName, facilityName, invoiceNumber, amount, dueDate, payUrl, items } = req.body;
  
  if (!to || !patientName || !facilityName || !invoiceNumber || !amount || !dueDate || !payUrl || !items) {
    return res.status(400).json({ error: "Missing required fields for invoice email" });
  }

  const emailData = generateInvoiceEmail({ patientName, facilityName, invoiceNumber, amount, dueDate, payUrl, items });
  await sendEmail(to, emailData.subject, emailData.html);
  
  res.json({ success: true, message: "Invoice email sent" });
});

// ── POST /api/email/send-alert ───────────────────────────────────────────────
router.post("/send-alert", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { to, firstName, device, location, ipAddress, timestamp, secureUrl } = req.body;
  
  if (!to || !firstName || !device || !location || !ipAddress || !timestamp || !secureUrl) {
    return res.status(400).json({ error: "Missing required fields for security alert email" });
  }

  const emailData = generateSecurityAlertEmail({ firstName, device, location, ipAddress, timestamp, secureUrl });
  await sendEmail(to, emailData.subject, emailData.html);
  
  res.json({ success: true, message: "Security alert email sent" });
});

export default router;
