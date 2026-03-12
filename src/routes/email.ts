import express from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { emailService } from "../services/emailService";

const router = express.Router();
router.use(requireAuth);

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
});

// Endpoint to send an email (e.g., triggered by frontend or an agent)
router.post("/send", async (req, res) => {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    }

    const { to, subject, html } = parsed.data;

    const result = await emailService.sendEmail({ to, subject, html });

    if (result.success) {
      return res.json({ message: "Email sent successfully" });
    } else {
      return res.status(500).json({ error: "Failed to send email", details: result.error });
    }
  } catch (error) {
    console.error("[Email Route] Error sending email:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
