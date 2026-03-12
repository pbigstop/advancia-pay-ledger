import { BaseAgent, AgentType } from "./baseAgent";

export class SupportHandlerAgent extends BaseAgent {
  readonly type = AgentType.SUPPORT_HANDLER;
  
  protected async run(input: {
    facilityId: string;
    userId: string;
    category: "payment" | "crypto" | "hipaa" | "billing" | "technical" | "general";
    question: string;
  }) {
    const { category, question } = input;
    
    const responses: Record<string, any> = {
      payment: {
        answer: "Payment processing issues are often resolved by: (1) Verifying the blockchain network is operational at status.advancia-healthcare.com, (2) Checking your wallet balance covers the transaction + fees, (3) Ensuring the recipient address is correct. For card payments, verify the billing address matches. If the issue persists, our billing team at billing@advancia-healthcare.com will resolve it within 2 hours.",
        escalate: false,
      },
      crypto: {
        answer: "Crypto transaction status: Solana confirms in ~400ms, Polygon/Base in ~2 seconds, Ethereum in ~12 seconds. You can track your transaction on the blockchain explorer linked in your payment receipt. If unconfirmed after 30 minutes, contact support@advancia-healthcare.com with your transaction hash.",
        escalate: false,
      },
      hipaa: {
        answer: "All patient data on our platform is protected with AES-256 encryption, complete audit trails, and role-based access controls in compliance with HIPAA Security Rule. For detailed compliance documentation, visit advancia-healthcare.com/hipaa or email security@advancia-healthcare.com for your Business Associate Agreement.",
        escalate: true,
      },
      billing: {
        answer: "Billing questions are handled by our dedicated billing team. You can view all invoices and subscription details in Settings → Billing. For refunds or billing disputes, email billing@advancia-healthcare.com — we resolve all billing inquiries within 24 hours.",
        escalate: false,
      },
      technical: {
        answer: "For technical issues, please check: (1) System status at status.advancia-healthcare.com, (2) API documentation at docs.advancia-healthcare.com, (3) Your .env configuration for correct API endpoints. For persistent technical issues, contact support@advancia-healthcare.com with your facility ID and error details.",
        escalate: true,
      },
      general: {
        answer: "Thank you for reaching out to Advancia Healthcare. Our support team is available 24/7 at support@advancia-healthcare.com. For urgent issues, you can also use the live chat in your dashboard.",
        escalate: false,
      },
    };
    
    const response = responses[category] || responses.general;
    
    // In production we would save a Notification record here.
    
    return {
      answer: response.answer,
      category,
      respondedBy: "Support Center",
      escalatedToHuman: response.escalate,
      escalationNote: response.escalate ? "A specialist will follow up within 2 hours." : null,
      supportEmail: "support@advancia-healthcare.com",
      timestamp: new Date().toISOString(),
    };
  }
}
