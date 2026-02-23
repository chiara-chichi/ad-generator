import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildBrandPrompt, brandContext } from "@/lib/brand-context";

let _client;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
  return _client;
}

export async function POST(request) {
  try {
    const { flavor, sku, channel, tone, userPrompt, referenceAnalysis } =
      await request.json();

    const product = brandContext.products.find(
      (p) => p.sku === sku || p.flavor === flavor
    );

    const channelInfo = brandContext.channels[channel] || brandContext.channels.social;

    const systemPrompt = `You are the creative copywriter for ChiChi Foods. You write ad copy that matches the brand voice perfectly.

${buildBrandPrompt()}

CHANNEL: ${channel || "social"} — ${channelInfo.emphasis}
TONE: ${tone || "playful, warm, energetic"}
${product ? `PRODUCT FOCUS: ${product.name} — ${product.keyBenefit} (${product.protein} protein, ${product.calories} cal)` : ""}
${referenceAnalysis ? `REFERENCE AD STYLE: ${referenceAnalysis.styleNotes || ""}` : ""}

Write ad copy that is punchy, on-brand, and makes people stop scrolling. Lead with taste and experience, follow with nutrition facts. Never say "oatmeal" — say "protein hot cereal" or "chickpea cereal." Keep copy concise for ad formats.`;

    const userMessage = userPrompt
      ? `Generate 3 ad copy variations for a ${channel || "social media"} ad. Additional direction: ${userPrompt}`
      : `Generate 3 ad copy variations for a ${channel || "social media"} ad${product ? ` featuring ${product.name}` : ""}.`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${userMessage}

Return ONLY valid JSON with this exact structure (no markdown, no explanation):

{
  "variations": [
    {
      "headline": "short punchy headline (max 8 words)",
      "subheadline": "supporting line (max 15 words)",
      "body": "brief body copy if needed (max 25 words, or empty string)",
      "cta": "call to action (2-4 words)"
    },
    {
      "headline": "...",
      "subheadline": "...",
      "body": "...",
      "cta": "..."
    },
    {
      "headline": "...",
      "subheadline": "...",
      "body": "...",
      "cta": "..."
    }
  ]
}`,
        },
      ],
    });

    const text = response.content[0].text;
    let copyData;
    try {
      copyData = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        copyData = JSON.parse(jsonMatch[1].trim());
      } else {
        copyData = { raw: text, error: "Could not parse response" };
      }
    }

    return NextResponse.json(copyData);
  } catch (error) {
    console.error("Generate copy error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate copy" },
      { status: 500 }
    );
  }
}
