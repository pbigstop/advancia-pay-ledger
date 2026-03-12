import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { emailService } from "../services/emailService";

const router = express.Router();
router.use(requireAuth);

const sendEmailSchema = z.object({
  to: z.union([
    z.string().email(),
    z.array(z.string().email()),
    z.object({ name: z.string(), address: z.string().email() })
  ]),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  amp: z.string().optional(),
  headers: z.record(z.string()).optional(),
  date: z.string().optional(),
  from: z.union([
    z.string().email(),
    z.object({ name: z.string(), address: z.string().email() })
  ]).optional(),
}).refine(data => data.html || data.text || data.amp, {
  message: "Must provide at least one of: html, text, or amp content",
});

// Endpoint to send an email (e.g., triggered by frontend or an agent)
router.post("/send", async (req, res) => {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    }

    const { to, subject, html, text, amp, headers, date, from } = parsed.data;

    const result = await emailService.sendEmail({ 
      to, 
      subject, 
      html,
      text,
      amp,
      headers,
      date,
      from
    });

    if (result.success) {
      return res.json({ message: "Email sent successfully", messageId: result.messageId });
    } else {
      return res.status(500).json({ error: "Failed to send email", details: result.error });
    }
  } catch (error) {
    console.error("[Email Route] Error sending email:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
