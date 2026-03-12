import { BaseAgent, AgentType } from "./baseAgent";

export class EmailComposerAgent extends BaseAgent {
  readonly type = AgentType.EMAIL_COMPOSER;
  
  protected async run(input: {
    facilityId: string;
    purpose: "payment_reminder" | "appointment_confirm" | "newsletter" | "collection" | "welcome" | "announcement";
    recipientType: "patient" | "staff" | "all";
    customData?: Record<string, any>;
  }) {
    const { purpose, recipientType, customData = {} } = input;
    
    const templates: Record<string, any> = {
      payment_reminder: {
        subject: `Payment Reminder — Action Required`,
        body: `Dear ${customData.name || "Valued Patient"},\n\nThis is a friendly reminder that your payment of $${customData.amount || "[AMOUNT]"} is due on ${customData.dueDate || "[DATE]"}.\n\nPay securely online using crypto or card:\n🔗 ${customData.payUrl || "app.advancia-healthcare.com/pay"}\n\nAccepted: SOL, ETH, MATIC, Credit/Debit, ACH\n\nQuestions? Reply to this email or call us.\n\nWarm regards,\n${customData.facilityName || "Our Team"}`,
        cta: "Pay Now",
        recommended_timing: "Send 7, 3, and 1 day before due date",
      },
      appointment_confirm: {
        subject: `Appointment Confirmed — ${customData.date || "[DATE]"} at ${customData.time || "[TIME]"}`,
        body: `Dear ${customData.name || "Patient"},\n\nYour appointment has been confirmed:\n\n📅 Date: ${customData.date || "[DATE]"}\n⏰ Time: ${customData.time || "[TIME]"}\n👨‍⚕️ Provider: ${customData.provider || "[PROVIDER]"}\n📍 Location: ${customData.location || "[LOCATION]"}\n\nPlease arrive 10-15 minutes early. Bring your insurance card and photo ID.\n\nYou can pay your copay in advance: app.advancia-healthcare.com/pay\n\nNeed to reschedule? Reply to this email.\n\nSee you soon!`,
        cta: "Add to Calendar",
        recommended_timing: "Send immediately after booking + reminder 24hrs before",
      },
      collection: {
        subject: `Urgent: Outstanding Balance — Please Respond`,
        body: `Dear ${customData.name || "Patient"},\n\nOur records show an outstanding balance of $${customData.amount || "[AMOUNT]"} from ${customData.serviceDate || "[DATE]"}.\n\nPlease arrange payment at your earliest convenience:\n🔗 app.advancia-healthcare.com/pay\n\nPayment plans are available. Contact billing@advancia-healthcare.com to discuss options.\n\nPlease respond within 10 days to avoid your account being referred to collections.\n\nSincerely,\nBilling Team`,
        cta: "Pay Balance",
        recommended_timing: "30, 60, 90 days past due",
      },
      newsletter: {
        subject: `${customData.facilityName || "Practice"} Healthcare Update — ${new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}`,
        body: `Dear Patient,\n\nWe wanted to share some updates from ${customData.facilityName || "our practice"}:\n\n🏥 New Services: ${customData.newServices || "[List new services]"}\n💳 Payments: We now accept cryptocurrency — pay with SOL, ETH, or MATIC\n📱 Patient Portal: Access your records and pay bills at app.advancia-healthcare.com\n\nThank you for trusting us with your healthcare.\n\nWarm regards,\n${customData.facilityName || "The Team"}`,
        cta: "Visit Patient Portal",
        recommended_timing: "Monthly on the first Tuesday",
      },
    };
    
    const template = templates[purpose] || templates.newsletter;
    
    return {
      ...template,
      purpose,
      recipientType,
      generatedBy: "Message Center",
      editInstructions: "Review and customize before sending. Replace [BRACKETED] fields with actual data.",
      platform: "advancia-healthcare.com",
    };
  }
}
