import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";
import { QUALITY_GUIDELINES } from "@/lib/design-system";

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

    const prompt = `You are recreating a reference ad for ChiChi Foods (chickpea protein hot cereal).

IN YOUR THINKING, analyze the reference image precisely:
1. Measure each section's height as a % of total (e.g., "header area = 60%, product row = 35%, footer = 5%")
2. Count exact elements: how many text blocks, badges, product items, buttons
3. Note each element's position, size relative to the ad, and alignment
4. Note what text each element contains (you'll swap it for ChiChi text)

YOUR #1 RULE: The HTML must match the reference's proportions and structure EXACTLY.

PROPORTIONS ARE CRITICAL:
- If the reference's product section takes ~35% of the height, yours must too. Use percentage heights or calc().
- If the headline area takes ~55% of space, yours must too. Don't compress or expand sections.
- If there's empty space in the reference, keep that empty space. Don't fill it with extra content.
- The outer container is exactly ${adWidth}x${adHeight}px — use % heights inside to match reference proportions.

STRUCTURE RULES:
- Same number of sections, same order, same arrangement
- If 4 items in a horizontal row → use display:flex with 4 equal children. Never stack or grid.
- If reference has a small badge/circle element, make yours the same relative size and position
- If reference has a CTA button at the bottom, include one at the bottom

ONLY SWAP THESE FOR CHICHI:
- Brand name → ChiChi
- Product type → chickpea protein hot cereal (NOT oatmeal)
- Colors → ChiChi brand colors: ${getBrandColors()}
- Fonts → "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body
- Flavor names → Peanut Butter Chip, Apple Cinnamon, Dark Chocolate, Maple Brown Sugar
${product ? `- Featured product: ${product.name} (${product.protein} protein)` : ""}

DO NOT ADD OR CHANGE:
- Do NOT add text/elements that aren't in the reference (no subtitles, no descriptions, no extra labels)
- Do NOT remove elements that are in the reference
- Do NOT change the layout arrangement (rows stay rows, columns stay columns)
- Do NOT use <img> tags — use colored rectangles as product placeholders, same size/position as reference
- If a product in the reference only has a name below it, yours should ONLY have a name — no extra subtitle
${userNotes ? `\nUSER DIRECTION: "${userNotes}"\nFollow the user's specific instructions.` : ""}

TECHNICAL:
- Size: ${adWidth}x${adHeight}px. All inline styles. No <style> tags.
- Use {{token_name}} for all text. Fonts: "Decoy, serif" headlines, "Questa Sans, sans-serif" body.
- Headlines should be big and bold. Give text breathing room. CTA high-contrast.

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
