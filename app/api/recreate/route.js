import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) return JSON.parse(m[1].trim());
  const o = text.match(/\{[\s\S]*\}/);
  if (o) return JSON.parse(o[0]);
  throw new Error("Could not parse AI response");
}

function getBrandColors() {
  const list = [];
  if (brandContext.colors?.primary)
    Object.entries(brandContext.colors.primary).forEach(([n, h]) => list.push(`${n}: ${h}`));
  if (brandContext.colors?.pairings)
    Object.entries(brandContext.colors.pairings).forEach(([n, h]) => list.push(`${n}: ${h}`));
  return list.join(", ");
}

export async function POST(request) {
  try {
    const { imageBase64, mediaType, adWidth, adHeight, userNotes, flavor, channel } =
      await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const product = brandContext.products?.find((p) => p.flavor === flavor);

    const prompt = `Look at this reference ad. Recreate it as a ChiChi Foods ad (chickpea protein hot cereal, NOT oatmeal).

Keep the EXACT same layout, proportions, and structure. Just swap the branding:
- Brand → ChiChi | chickpeaoats.com
- Colors → ${getBrandColors()}
- Fonts → "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body
- Flavors → Peanut Butter Chip, Apple Cinnamon, Dark Chocolate, Maple Brown Sugar
${product ? `- Product: ${product.name} (${product.protein} protein)` : ""}
${userNotes ? `\nUser notes: "${userNotes}"` : ""}

Output exactly ${adWidth}x${adHeight}px. All inline styles. No <style> tags. No <img> tags — use colored shapes as product placeholders.
Use {{token_name}} for all text content.

Return ONLY valid JSON:
{"html": "<div style='width:${adWidth}px;height:${adHeight}px;...'>...</div>", "fields": {"token": "value"}, "backgroundColor": "#hex", "textColor": "#hex", "accentColor": "#hex"}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 5000 },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } },
          { type: "text", text: prompt },
        ],
      }],
    });

    // Extract text block (skip thinking blocks)
    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock) throw new Error("No text response from AI");

    const result = parseJSON(textBlock.text);
    if (!result.html || !result.fields) throw new Error("AI response missing html or fields");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recreate error:", error);
    return NextResponse.json({ error: error.message || "Failed to recreate ad" }, { status: 500 });
  }
}
