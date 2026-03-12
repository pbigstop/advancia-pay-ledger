import { BaseAgent, AgentType } from "./baseAgent";

export class ContentCreatorAgent extends BaseAgent {
  readonly type = AgentType.CONTENT_CREATOR;
  
  protected async run(input: {
    type: "social_post" | "email_campaign" | "blog_post" | "press_release" | "patient_notice" | "payment_announcement";
    facilityName: string;
    topic: string;
    tone: "professional" | "friendly" | "urgent" | "celebratory";
    targetAudience: "patients" | "staff" | "investors" | "public";
    keywords?: string[];
    wordCount?: number;
  }) {
    const { type, facilityName, topic, tone, targetAudience, keywords = [], wordCount = 200 } = input;
    
    // Content templates by type
    const content = await this.generateContent({ type, facilityName, topic, tone, targetAudience, keywords, wordCount });
    
    return {
      content,
      type,
      wordCount: content.body?.split(" ").length || 0,
      generatedBy: "Content Studio",
      platform: "advancia-healthcare.com",
      timestamp: new Date().toISOString(),
    };
  }
  
  private async generateContent(params: any): Promise<any> {
    const { type, facilityName, topic, tone, targetAudience } = params;
    
    const toneMap: Record<string, string> = {
      professional: "Healthcare facilities depend on reliable infrastructure.",
      friendly: "We're excited to share some great news with you!",
      urgent: "Important update regarding your account.",
      celebratory: "We're thrilled to announce a major milestone!",
    };
    
    const opener = toneMap[tone] || toneMap.professional;
    
    if (type === "social_post") {
      return {
        platform_variants: {
          twitter: `${facilityName} is transforming healthcare payments. ${topic}. Accept crypto + traditional payments with full HIPAA compliance. advancia-healthcare.com`,
          linkedin: `${opener}\n\n${facilityName} continues to lead healthcare payment innovation.\n\n${topic}\n\nLearn how we're making healthcare payments simpler, faster, and more secure for ${targetAudience}.\n\n#HealthcareFintech #CryptoPayments #HIPAA`,
          facebook: `${opener}\n\n${topic}\n\nContact us to learn how ${facilityName} is making a difference.\n\nadvancia-healthcare.com`,
        },
        hashtags: ["#HealthcareFintech", "#CryptoPayments", "#HIPAA", "#HealthTech", "#PaymentInnovation"],
        bestPostTime: "10:00 AM EST Tuesday-Thursday",
      };
    }
    
    if (type === "email_campaign") {
      return {
        subject: `${facilityName}: ${topic}`,
        preheader: `Important update from ${facilityName}`,
        body: `${opener}\n\n${topic}\n\nAt ${facilityName}, we're committed to providing the most advanced healthcare payment solutions. Our platform processes payments across 4 blockchain networks while maintaining strict HIPAA compliance.\n\nLearn more at advancia-healthcare.com`,
        cta: "Learn More",
        cta_url: `https://app.advancia-healthcare.com`,
      };
    }
    
    if (type === "press_release") {
      return {
        headline: `${facilityName} Advances Healthcare Payment Innovation with ${topic}`,
        dateline: `${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        body: `${facilityName} today announced ${topic}. The healthcare payment platform, which currently serves 24 facilities and processes $247K in monthly recurring revenue, continues to lead the industry in combining multi-blockchain payment infrastructure with HIPAA-compliant healthcare operations.\n\n"${opener}" said a spokesperson for ${facilityName}.\n\nFor more information, contact: press@advancia-healthcare.com`,
        boilerplate: `About Advancia Healthcare: advancia-healthcare.com is the leading healthcare payment platform combining crypto and traditional payments with full HIPAA compliance. Trusted by 24 facilities with $247K MRR and 42% month-over-month growth.`,
      };
    }
    
    if (type === "patient_notice") {
      return {
        subject: `Important Notice from ${facilityName}`,
        body: `Dear Patient,\n\n${opener}\n\n${topic}\n\nIf you have questions about your payments or account, please contact us at:\n• Email: support@advancia-healthcare.com\n• Portal: app.advancia-healthcare.com\n\nThank you for trusting ${facilityName} with your healthcare.\n\nSincerely,\n${facilityName} Team`,
      };
    }
    
    if (type === "payment_announcement") {
      return {
        internal_announcement: `${facilityName} Payment Update\n\n${opener}\n\n${topic}\n\nOur payment platform now supports: Solana (SOL), Ethereum (ETH), Polygon (MATIC), Base (ETH), Credit/Debit Cards, and ACH transfers.\n\nAll transactions are HIPAA-compliant with real-time monitoring.`,
        patient_facing: `We now accept cryptocurrency payments! Pay your healthcare bills with SOL, ETH, or MATIC — in addition to cards and ACH. Faster, more secure payments at advancia-healthcare.com.`,
      };
    }
    
    return {
      title: `${facilityName}: ${topic}`,
      excerpt: `${opener} ${topic.slice(0, 120)}...`,
      body: `${opener}\n\n${topic}\n\nAdvancia Healthcare is the leading platform for healthcare payment innovation, combining multi-blockchain capabilities with comprehensive facility management.\n\nLearn more at advancia-healthcare.com`,
      meta_description: `${topic.slice(0, 155)}`,
      tags: ["healthcare", "payments", "fintech", "hipaa", "crypto"],
    };
  }
}
