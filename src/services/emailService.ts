import nodemailer from "nodemailer";
import { Readable } from "stream";

export type EmailRecipient = string | string[] | { name: string; address: string };

export interface SendEmailParams {
  to: EmailRecipient;
  subject: string;
  html?: string | Readable;
  text?: string;
  amp?: string;
  headers?: Record<string, string>;
  date?: Date | string;
  from?: EmailRecipient;
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
  async sendEmail(params: SendEmailParams) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("[EmailService] No SMTP credentials configured. Skipping email send.", { to: params.to, subject: params.subject });
      return { success: true, message: "Email skipped (no config)" };
    }

    try {
      const defaultFrom = `Advancia Pay Ledger <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
      
      const mailOptions: nodemailer.SendMailOptions = {
        from: params.from || defaultFrom,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        amp: params.amp,
        headers: params.headers,
        date: params.date ? new Date(params.date) : undefined,
      };

      const info = await transporter.sendMail(mailOptions);
      
      console.log(`[EmailService] Email sent to ${JSON.stringify(params.to)}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("[EmailService] Failed to send email:", error);
      return { success: false, error };
    }
  },
};
