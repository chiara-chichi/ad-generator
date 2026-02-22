import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { adHtml, channel, adSize } = await request.json();

    if (!adHtml) {
      return NextResponse.json({ error: "No ad HTML provided" }, { status: 400 });
    }

    const prompt = `You are reviewing a ChiChi Foods ad (chickpea protein hot cereal) for Meta/Instagram performance.

IMPORTANT CONTEXT: This is an HTML/CSS-only ad — no real photography is available. Judge it on what IS controllable: layout, typography, color usage, copy, CTA, visual hierarchy, and overall design quality. Do NOT penalize for lack of real product photos.

Ad HTML:
${adHtml}

CHANNEL: ${channel || "social media"}
SIZE: ${adSize || "1080x1080"}

Score honestly but fairly. A well-designed HTML-only ad with strong copy and layout CAN score 7-8. Reserve 9-10 for exceptional work. Score below 5 only for genuinely broken or unreadable ads.

Evaluate:
- Visual hook (does it grab attention?)
- Message clarity (ONE clear message?)
- CTA strength
- Text readability at mobile size
- Layout quality and visual hierarchy
- Brand color usage

Return ONLY valid JSON:
{
  "score": <1-10>,
  "verdict": "<one sentence>",
  "strengths": ["<strength>", "<strength>"],
  "improvements": [{"issue": "<what>", "fix": "<how>", "priority": "high|medium|low"}],
  "hookScore": <1-10>,
  "ctaScore": <1-10>,
  "clarityScore": <1-10>,
  "visualScore": <1-10>,
  "tips": ["<tip>"]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          result = JSON.parse(objMatch[0]);
        } else {
          throw new Error("Could not parse AI response");
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Review ad error:", error);
    return NextResponse.json({ error: error.message || "Failed to review ad" }, { status: 500 });
  }
}
