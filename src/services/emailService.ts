import sgMail from "@sendgrid/mail";

const BASE_URL = process.env.FRONTEND_URL || "https://advancia-healthcare.com";
const APP_URL = process.env.APP_BASE_URL || "https://app.advancia-healthcare.com";
const BILLING_EMAIL = "billing@advancia-healthcare.com";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function baseLayout(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Advancia Healthcare</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f9ff; color: #0f172a; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(14,165,233,0.1); }
    .header { background: linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 100%); padding: 40px 40px 48px; }
    .header-logo { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; }
    .logo-mark { width: 44px; height: 44px; background: rgba(255,255,255,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; color: white; letter-spacing: -1px; }
    .logo-text { color: white; font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
    .logo-sub { color: rgba(255,255,255,0.7); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; display: block; }
    .body { padding: 40px; }
    .footer { background: #f0f9ff; padding: 24px 40px; border-top: 1px solid #e0f2fe; }
    .footer-links { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px; }
    .footer-links a { color: #0ea5e9; text-decoration: none; font-size: 13px; }
    .footer-text { text-align: center; color: #64748b; font-size: 12px; line-height: 1.6; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; text-decoration: none; letter-spacing: -0.2px; }
    .btn-primary { background: #0ea5e9; color: white !important; }
    .btn-danger { background: #ef4444; color: white !important; }
    .btn-success { background: #10b981; color: white !important; }
    .divider { border: none; border-top: 1px solid #e0f2fe; margin: 28px 0; }
    .info-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .success-box { background: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .warning-box { background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .danger-box { background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .stat-box { background: #f0f9ff; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: #0c4a6e; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    h1 { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px; margin-top: 20px; }
    h2 { font-size: 22px; font-weight: 700; color: #0c4a6e; letter-spacing: -0.3px; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.7; color: #374151; margin-bottom: 16px; }
    .amount { font-size: 36px; font-weight: 900; color: #0c4a6e; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-success { background: #ecfdf5; color: #059669; }
    .badge-warning { background: #fffbeb; color: #d97706; }
    .badge-danger { background: #fef2f2; color: #dc2626; }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    .table th { background: #f0f9ff; padding: 10px 14px; text-align: left; font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .table td { padding: 12px 14px; border-top: 1px solid #e0f2fe; }
    .center { text-align: center; }
    .crypto-badge { display: inline-flex; align-items: center; gap: 6px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 600; color: #0369a1; }
  </style>
</head>
<body>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ""}
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <a class="header-logo" href="${BASE_URL}">
          <div class="logo-mark">A</div>
          <div>
            <div class="logo-text">Advancia Healthcare</div>
            <span class="logo-sub">advancia-healthcare.com</span>
          </div>
        </a>
        ${content.split("<!--HEADER_CONTENT-->")[1] ? content.split("<!--HEADER_CONTENT-->")[1].split("<!--/HEADER_CONTENT-->")[0] : ""}
      </div>
      <div class="body">
        ${content.replace(/<!--HEADER_CONTENT-->[\s\S]*?<!--\/HEADER_CONTENT-->/g, "")}
      </div>
      <div class="footer">
        <div class="footer-links">
          <a href="${APP_URL}/dashboard">Dashboard</a>
          <a href="${BASE_URL}/help">Help Center</a>
          <a href="${BASE_URL}/privacy">Privacy</a>
          <a href="${BASE_URL}/terms">Terms</a>
          <a href="${APP_URL}/notifications/unsubscribe">Unsubscribe</a>
        </div>
        <p class="footer-text">
          © ${new Date().getFullYear()} Advancia Healthcare · advancia-healthcare.com<br>
          Healthcare payment processing for modern facilities · HIPAA Compliant · PCI-DSS Certified
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(to: string, subject: string, htmlContent: string) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("[EmailService] No SendGrid API key configured. Skipping email send.", { to, subject });
    return;
  }
  
  const msg = {
    to,
    from: "noreply@advancia-healthcare.com",
    subject,
    html: htmlContent,
  };
  
  try {
    await sgMail.send(msg);
    console.log(`[EmailService] Sent email to ${to}: ${subject}`);
  } catch (error) {
    console.error("[EmailService] Error sending email:", error);
  }
}

export function generateWelcomeEmail(data: { firstName: string; facilityName: string; loginUrl: string; verifyUrl?: string; }) {
  const content = `
<!--HEADER_CONTENT-->
<h1>Welcome to Advancia Healthcare! 🎉</h1>
<!--/HEADER_CONTENT-->
<h2>Hi ${data.firstName}, you're in!</h2>
<p>Your account for <strong>${data.facilityName}</strong> has been created successfully. You now have access to the most advanced healthcare payment platform — combining crypto and traditional payments with full HIPAA compliance.</p>

${data.verifyUrl ? `
<div class="info-box">
  <strong>⚡ One more step:</strong> Verify your email to unlock all features.
</div>
<div class="center" style="margin: 28px 0;">
  <a href="${data.verifyUrl}" class="btn btn-primary">Verify My Email</a>
</div>
` : ""}

<div class="stats-grid">
  <div class="stat-box">
    <div class="stat-value">4</div>
    <div class="stat-label">Blockchains</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">0.8%</div>
    <div class="stat-label">Low Fees</div>
  </div>
  <div class="stat-box">
    <div class="stat-value">24/7</div>
    <div class="stat-label">Support</div>
  </div>
</div>

<p><strong>What you can do right now:</strong></p>
<p>→ Set up your first crypto wallet (SOL, ETH, MATIC, ETH Base)<br>
→ Add patients and process your first payment<br>
→ Connect your existing EHR system<br>
→ Invite your team members</p>

<div class="center" style="margin: 28px 0;">
  <a href="${data.loginUrl}" class="btn btn-primary">Go to Dashboard →</a>
</div>

<p>Questions? Reply to this email or visit our <a href="${BASE_URL}/help" style="color:#0ea5e9;">Help Center</a>. We're here 24/7.</p>
<p>To healthcare payments that actually work,<br><strong>The Advancia Healthcare Team</strong></p>`;

  return {
    subject: `Welcome to Advancia Healthcare, ${data.firstName}! 🚀`,
    html: baseLayout(content, `Your healthcare payment platform is ready, ${data.firstName}!`),
  };
}

export function generateEmailVerificationEmail(data: { firstName: string; verifyUrl: string; }) {
  const content = `
<!--HEADER_CONTENT-->
<h1>Verify Your Email</h1>
<!--/HEADER_CONTENT-->
<h2>Almost there, ${data.firstName}!</h2>
<p>Click the button below to verify your email address and activate your Advancia Healthcare account. This link expires in <strong>24 hours</strong>.</p>

<div class="center" style="margin: 36px 0;">
  <a href="${data.verifyUrl}" class="btn btn-primary">Verify Email Address</a>
</div>

<p style="font-size:13px;color:#64748b;">Or copy this link into your browser:<br>
<a href="${data.verifyUrl}" style="color:#0ea5e9;word-break:break-all;">${data.verifyUrl}</a></p>

<hr class="divider">
<p style="font-size:13px;color:#64748b;">Didn't create an account? Ignore this email — your email won't be verified without clicking the button above.</p>`;

  return {
    subject: "Verify your email — Advancia Healthcare",
    html: baseLayout(content, "Click to verify your email address"),
  };
}

export function generateInvoiceEmail(data: { patientName: string; facilityName: string; invoiceNumber: string; amount: number; dueDate: string; payUrl: string; items: { description: string; amount: number }[]; }) {
  const content = `
<!--HEADER_CONTENT-->
<h1>Invoice from ${data.facilityName}</h1>
<!--/HEADER_CONTENT-->
<h2>Hi ${data.patientName},</h2>
<p>Please find your invoice from <strong>${data.facilityName}</strong>. You can pay securely online using crypto or traditional payment methods.</p>

<div class="info-box">
  <strong>Invoice #${data.invoiceNumber}</strong><br>
  Amount Due: <strong>$${data.amount.toFixed(2)}</strong><br>
  Due: ${data.dueDate}
</div>

<table class="table">
  <tr><th>Description</th><th style="text-align:right;">Amount</th></tr>
  ${data.items.map(item => `<tr><td>${item.description}</td><td style="text-align:right;">$${item.amount.toFixed(2)}</td></tr>`).join("")}
  <tr style="font-weight:700;"><td>Total</td><td style="text-align:right;">$${data.amount.toFixed(2)}</td></tr>
</table>

<p>We accept: SOL, ETH, MATIC, credit card, debit card, and ACH transfer.</p>

<div class="center" style="margin: 28px 0;">
  <a href="${data.payUrl}" class="btn btn-primary">Pay Invoice Now →</a>
</div>

<p style="font-size:13px;color:#64748b;">Questions? Contact ${data.facilityName} or email us at <a href="mailto:${BILLING_EMAIL}" style="color:#0ea5e9;">${BILLING_EMAIL}</a></p>`;

  return {
    subject: `Invoice #${data.invoiceNumber} from ${data.facilityName} — $${data.amount.toFixed(2)} due ${data.dueDate}`,
    html: baseLayout(content, `Invoice for $${data.amount.toFixed(2)} due ${data.dueDate}`),
  };
}

export function generateSecurityAlertEmail(data: { firstName: string; device: string; location: string; ipAddress: string; timestamp: string; secureUrl: string; }) {
  const content = `
<!--HEADER_CONTENT-->
<h1>🔐 New Login Detected</h1>
<!--/HEADER_CONTENT-->
<h2>Hi ${data.firstName}, was this you?</h2>
<p>We detected a new login to your Advancia Healthcare account from:</p>

<div class="danger-box">
  <strong>📍 ${data.location}</strong><br>
  Device: ${data.device}<br>
  IP Address: ${data.ipAddress}<br>
  Time: ${data.timestamp}
</div>

<p>If this was you, no action needed. If you don't recognize this login, secure your account immediately:</p>

<div class="center" style="margin: 28px 0;">
  <a href="${data.secureUrl}" class="btn btn-danger">Secure My Account</a>
</div>

<p style="font-size:13px;color:#64748b;">We recommend enabling two-factor authentication (2FA) to prevent unauthorized access.</p>`;

  return {
    subject: "Security Alert: New login from " + data.location,
    html: baseLayout(content, "New login detected to your account"),
  };
}
