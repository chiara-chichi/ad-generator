import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _client;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
  return _client;
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return JSON.parse(m[1].trim());
  const o = text.match(/\{[\s\S]*\}/);
  if (o) return JSON.parse(o[0]);
  throw new Error("Could not parse AI response");
}

export async function POST(request) {
  try {
    const { renderUrl, channel, adSize } = await request.json();

    if (!renderUrl) {
      return NextResponse.json(
        { error: "No render URL provided" },
        { status: 400 }
      );
    }

    // Fetch the rendered image and convert to base64
    const imageResponse = await fetch(renderUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch render image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString("base64");

    // Determine media type from Content-Type header or URL
    let mediaType = imageResponse.headers.get("content-type") || "image/png";
    if (renderUrl.endsWith(".jpg") || renderUrl.endsWith(".jpeg")) {
      mediaType = "image/jpeg";
    }

    const prompt = `You are reviewing a ChiChi Foods ad (chickpea protein hot cereal) for Meta/Instagram performance.

This is a professionally rendered ad from a template system. Judge it on: layout, typography, color usage, copy quality, CTA strength, visual hierarchy, and overall design impact.

CHANNEL: ${channel || "social media"}
SIZE: ${adSize || "1080x1080"}

Score honestly. A well-designed ad with strong copy and layout should score 7-8. Reserve 9-10 for exceptional, agency-quality work. Score below 5 only for genuinely poor or unreadable ads.

Evaluate:
- Visual hook (does it grab attention in a feed?)
- Message clarity (ONE clear message?)
- CTA strength and prominence
- Text readability at mobile size
- Layout quality and visual hierarchy
- Brand consistency and color usage

For improvements, focus on things that can be changed via the template fields: text copy, colors, image choices. Don't suggest layout changes that require a different template unless really necessary.

Return ONLY valid JSON:
{
  "score": <1-10>,
  "verdict": "<one sentence>",
  "strengths": ["<strength>", "<strength>"],
  "improvements": [{"issue": "<what>", "fix": "<how to fix via field edits>", "priority": "high|medium|low"}],
  "hookScore": <1-10>,
  "ctaScore": <1-10>,
  "clarityScore": <1-10>,
  "visualScore": <1-10>,
  "tips": ["<channel-specific tip>"]
}`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No response from AI");

    const result = parseJSON(textBlock.text);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Review ad error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to review ad" },
      { status: 500 }
    );
  }
}
