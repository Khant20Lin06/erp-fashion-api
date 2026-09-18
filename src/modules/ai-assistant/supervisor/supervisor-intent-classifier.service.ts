import { Injectable, Logger } from '@nestjs/common';
import { DomainAgentType } from '../agents/domain-agent.interface';
import { SupervisorIntent } from './supervisor.interface';

interface IntentRule {
  agent: DomainAgentType;
  intent: string;
  patterns: RegExp[];
  weight: number;
}

@Injectable()
export class SupervisorIntentClassifierService {
  private readonly logger = new Logger(SupervisorIntentClassifierService.name);

  private readonly rules: IntentRule[] = [
    {
      agent: 'finance',
      intent: 'financial_reporting_and_audit',
      weight: 1.0,
      patterns: [
        /အရှုံး\s*အမြတ်|အမြတ်|အရှုံး/i,
        /ဘဏ္ဍာရေး|ငွေစာရင်း|စာရင်းချုပ်/i,
        /အကြွေး|ကြွေးကျန်|ပေးရန်ရှိ|ရရန်ရှိ/i,
        /\b(?:profit|loss|p&l|balance\s+sheet|financial\s+statement)\b/i,
        /\b(?:ar[\s/-]?ap|accounts\s+receivable|accounts\s+payable|aging\s+report)\b/i,
        /\b(?:assets?|liabilit(?:y|ies)|net\s+income|equity)\b/i,
      ],
    },
    {
      agent: 'inventory',
      intent: 'warehouse_and_stock_management',
      weight: 0.95,
      patterns: [
        /စတော့|လက်ကျန်|ဂိုဒေါင်|သိုလှောင်/i,
        /ပစ္စည်းကုန်|ကျန်ရှိ|လက်ကျန်စတော့/i,
        /ရောင်းအား\s*နှေး|မရောင်းရသော/i,
        /\b(?:stock|inventory|warehouse|on[\s-]hand)\b/i,
        /\b(?:slow[\s-]moving|excess\s+stock|stockout|reorder)\b/i,
      ],
    },
    {
      agent: 'sales_pos',
      intent: 'retail_sales_and_pos_analytics',
      weight: 0.9,
      patterns: [
        /အရောင်း|ရောင်းရငွေ|ရောင်းအား/i,
        /ဘယ်လောက်\s*ရောင်းရ|ရောင်းရဆုံး|အများဆုံး\s*ရောင်း/i,
        /ကောင်တာ|ဘောက်ချာ\s*အရောင်း/i,
        /\b(?:sales|revenue|pos|top[\s-]products?|best[\s-]sellers?)\b/i,
        /\b(?:turnover|sales\s+summary|daily\s+sales|units\s+sold)\b/i,
      ],
    },
    {
      agent: 'customer_service',
      intent: 'customer_care_and_catalog_inquiry',
      weight: 0.8,
      patterns: [
        /ဝယ်ချင်|စျေး|ဈေးနှုန်း|စျေးနှုန်း/i,
        /အရွယ်အစား|ဆိုဒ်|အရောင်|အင်္ကျီ|ဘောင်းဘီ|ဂါဝန်/i,
        /လဲလှယ်|ပို့ခ|ပို့ဆောင်|စည်းကမ်း|ဆိုင်ဖွင့်/i,
        /မင်္ဂလာပါ|ကူညီ|မေးချင်/i,
        /\b(?:buy|purchase|price|cost|size|color|sizing)\b/i,
        /\b(?:shirt|pants|dress|jacket|shoes|t-shirt|skirt)\b/i,
        /\b(?:shipping|delivery|exchange|refund|policy|return)\b/i,
        /\b(?:hello|hi|help|contact|store\s+hours)\b/i,
      ],
    },
  ];

  classify(query: string): SupervisorIntent {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        targetAgent: 'customer_service',
        intent: 'general_assistance',
        confidence: 0.5,
        reasoning: 'Empty query, defaulting to customer concierge',
      };
    }

    let bestMatch: {
      targetAgent: DomainAgentType;
      intent: string;
      confidence: number;
      reasoning: string;
    } | null = null;

    let highestScore = 0;

    for (const rule of this.rules) {
      let matchCount = 0;
      for (const pattern of rule.patterns) {
        if (pattern.test(trimmed)) {
          matchCount += 1;
        }
      }

      if (matchCount > 0) {
        // Compute confidence: base weight + scaling with pattern matches
        const confidence = Math.min(
          0.99,
          rule.weight * (1 + 0.1 * (matchCount - 1)),
        );
        const score = matchCount * rule.weight;

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            targetAgent: rule.agent,
            intent: rule.intent,
            confidence: Number(confidence.toFixed(2)),
            reasoning: `Matched ${matchCount} pattern(s) for domain '${rule.agent}'`,
          };
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    // Default fallback
    return {
      targetAgent: 'customer_service',
      intent: 'general_assistance',
      confidence: 0.6,
      reasoning: 'No specific domain trigger matched; routing to Customer Service Concierge',
    };
  }
}
