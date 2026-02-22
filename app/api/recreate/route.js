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

BEFORE GENERATING ANY HTML, study the reference image carefully in your thinking:
- What is the background (solid color, gradient, texture)?
- How many distinct vertical sections are there? What % of height does each take?
- In each section, how many items are arranged? In a row or column?
- What is the text alignment (left, center, right) for each text element?
- What colors are used for background, text, accents, and any colored blocks?
- Where are product images/shapes positioned and how large are they?
- What is the overall visual hierarchy?

YOUR #1 GOAL: The generated HTML must look like the reference — same structure, same proportions, same spacing patterns, same number of elements.

WHAT TO KEEP IDENTICAL FROM THE REFERENCE:
- Layout structure (exact number of rows, columns, sections)
- Proportions (% of space allocated to each section)
- Text alignment and positioning (left/center/right)
- Visual hierarchy and flow
- Spacing patterns and padding ratios
- Number of product items and their arrangement (if 4 items in a row → 4 items in a row, NOT 2x2)
- Shape and size of colored blocks, badges, buttons

WHAT TO SWAP FOR CHICHI:
- Brand name/text → ChiChi Foods / chickpea protein hot cereal
- Colors → use ChiChi brand colors: ${getBrandColors()}
- Fonts → "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body
- Product names → ChiChi flavors (Peanut Butter Chip, Apple Cinnamon, Dark Chocolate, Maple Brown Sugar)
${product ? `- Featured product: ${product.name} — ${product.keyBenefit} (${product.protein} protein)` : ""}

DO NOT:
- Add elements that are NOT in the reference (no extra text, no extra badges, no descriptions)
- Remove elements that ARE in the reference
- Change item arrangements (a horizontal row stays a horizontal row — never turn it into a grid)
- Add real product images — use colored rectangles/shapes as placeholders, same size and position as reference
- Reorganize or "improve" the layout — copy it faithfully
${userNotes ? `\nUSER DIRECTION: "${userNotes}"\nFollow the user's specific instructions, using their exact text if they provided copy.` : ""}

${QUALITY_GUIDELINES}

TECHNICAL REQUIREMENTS:
- Size: exactly ${adWidth}x${adHeight}px
- All styling must be inline. No <style> tags.
- Use {{token_name}} placeholders for ALL text content
- ChiChi makes chickpea hot cereal, NOT oatmeal

Return ONLY valid JSON (no markdown, no explanation):
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
