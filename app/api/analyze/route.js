import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _client;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY });
  return _client;
}

export async function POST(request) {
  try {
    const { imageBase64, mediaType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/png",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `You are an expert graphic designer analyzing a reference advertisement image. Analyze the layout, composition, and design elements to help recreate a similar ad for a different brand.

Analyze this ad and return a JSON response with EXACTLY this structure (no markdown, just raw JSON):

{
  "layout": {
    "structure": "one of: hero-product, lifestyle-overlay, split-layout, bold-typography, grid, collage",
    "description": "brief description of the overall layout"
  },
  "textHierarchy": [
    {
      "role": "headline | subheadline | body | cta | tagline",
      "position": "top-left | top-center | top-right | center | bottom-left | bottom-center | bottom-right",
      "style": "bold | regular | italic | uppercase",
      "approximateText": "what the text roughly says"
    }
  ],
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "styleNotes": "2-3 sentences describing the visual style, mood, and feel",
  "suggestedTemplate": "one of: hero-product, lifestyle-overlay, split-layout, bold-typography",
  "designElements": ["list of notable design elements like: gradient, border, badge, pattern, shadow, rounded-corners"]
}

Return ONLY valid JSON, no explanation or markdown.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].text;
    // Try to parse JSON from response
    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1].trim());
      } else {
        analysis = { raw: text, error: "Could not parse structured response" };
      }
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze image" },
      { status: 500 }
    );
  }
}
