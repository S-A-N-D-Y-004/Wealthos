import { AI_INSIGHT_SYSTEM_POLICY, assertInsightSafety } from "@/lib/ai/insight-policy";

export type AIProviderName = "openai" | "gemini" | "claude";

export type InsightPrompt = {
  type: "net-worth" | "goal" | "retirement" | "diversification" | "risk" | "discipline";
  facts: Record<string, unknown>;
  userQuestion?: string;
};

export type AIProvider = {
  name: AIProviderName;
  generateInsight(prompt: InsightPrompt): Promise<string>;
};

export class AIInsightService {
  constructor(private readonly provider: AIProvider) {}

  async generate(prompt: InsightPrompt) {
    const body = await this.provider.generateInsight(prompt);
    return assertInsightSafety(body);
  }
}

export function buildInsightMessages(prompt: InsightPrompt) {
  return [
    { role: "system", content: AI_INSIGHT_SYSTEM_POLICY },
    {
      role: "user",
      content: JSON.stringify(
        {
          insightType: prompt.type,
          facts: prompt.facts,
          userQuestion: prompt.userQuestion
        },
        null,
        2
      )
    }
  ] as const;
}

export function createUnavailableProvider(name: AIProviderName): AIProvider {
  return {
    name,
    async generateInsight() {
      return [
        "AI provider credentials are not configured.",
        "WealthOS can still run deterministic analysis and will enable generated insights after provider setup."
      ].join(" ");
    }
  };
}

