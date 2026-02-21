import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { adHtml, channel, adSize } = await request.json();

    if (!adHtml) {
      return NextResponse.json(
        { error: "No ad HTML provided" },
        { status: 400 }
      );
    }

    const prompt = `You are a senior performance marketing specialist who has managed millions in Meta/Instagram ad spend. You're reviewing a ChiChi Foods ad (chickpea protein hot cereal brand) for conversion optimization.

Here is the ad HTML:
${adHtml}

CHANNEL: ${channel || "social media"}
SIZE: ${adSize || "1080x1080"}

Analyze this ad from a PAID PERFORMANCE perspective. Think about:
- Does it stop the scroll? (visual hook)
- Is there ONE clear message? (not 5 competing messages)
- Is the CTA strong and clear?
- Would this convert on Meta/Instagram?
- Is the text readable at mobile size?
- Is there social proof or urgency?
- Does it follow the 20% text rule for Meta?

Be honest and specific. Don't sugarcoat — give real, actionable feedback that would improve ROAS.

Return ONLY valid JSON (no markdown fences):
{
  "score": <number 1-10>,
  "verdict": "<one blunt sentence>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "improvements": [
    {
      "issue": "<what's wrong>",
      "fix": "<exactly what to change>",
      "priority": "high" | "medium" | "low"
    }
  ],
  "hookScore": <1-10>,
  "ctaScore": <1-10>,
  "clarityScore": <1-10>,
  "visualScore": <1-10>,
  "tips": ["<platform-specific tip>", "<tip 2>"]
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
    return NextResponse.json(
      { error: error.message || "Failed to review ad" },
      { status: 500 }
    );
  }
}
