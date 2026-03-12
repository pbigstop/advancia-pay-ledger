import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Configure Nodemailer transporter
// You will need to provide SMTP credentials in your .env file
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true" || false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const emailService = {
  async sendEmail({ to, subject, html }: SendEmailParams) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("[EmailService] No SMTP credentials configured. Skipping email send.", { to, subject });
      return { success: true, message: "Email skipped (no config)" };
    }

    try {
      const info = await transporter.sendMail({
        from: `Advancia Pay Ledger <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });
      
      console.log(`[EmailService] Email sent to ${to}. Message ID: ${info.messageId}`);
      return { success: true };
    } catch (error) {
      console.error("[EmailService] Failed to send email:", error);
      return { success: false, error };
    }
  },
};
