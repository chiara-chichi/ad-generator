import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildBrandPrompt, brandContext } from "@/lib/brand-context";
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

    // ========== PASS 1: Generate the ad ==========
    const generatePrompt = `You are recreating a reference ad for ChiChi Foods (chickpea protein hot cereal).

BRAND: ${brandContext.brand.name} — ${brandContext.brand.tagline} | ${brandContext.brand.website}
BRAND COLORS (use ONLY these): ${getBrandColors()}
FONTS: "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body.
${product ? `PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein)` : ""}

${QUALITY_GUIDELINES}

CRITICAL LAYOUT RULES:
- Count EXACTLY how many sections, boxes, columns, rows, images, and text blocks are in the reference.
- Recreate that EXACT structure. If reference has 4 items in 1 row, make 4 items in 1 row — NOT 2x2.
- If reference has a horizontal row of products, make a horizontal row. NOT a grid. NOT cards with descriptions.
- Match the reference's proportions: what % of space goes to headline vs products vs footer.
- Match text alignment (left/center/right) from the reference.
- Replace reference brand colors with the closest ChiChi brand colors.
- DO NOT add elements the reference doesn't have (no extra descriptions, no cards around products).
- DO NOT remove elements the reference has.
- If the reference has product images, use colored rectangles or simple shapes as placeholders — same size and position.
${userNotes ? `\nUSER DIRECTION: "${userNotes}"\nUse the user's EXACT text if they provided specific text content.` : ""}

The ad must be exactly ${adWidth}x${adHeight}px. All styling inline. No <style> tags.
Use {{token_name}} placeholders for text. ChiChi makes chickpea hot cereal, NOT oatmeal.

Return ONLY valid JSON:
{"html": "<div style='width:${adWidth}px;height:${adHeight}px;...'>...</div>", "fields": {"token": "value"}, "backgroundColor": "#hex", "textColor": "#hex", "accentColor": "#hex"}`;

    const pass1 = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } },
          { type: "text", text: generatePrompt },
        ],
      }],
    });

    let result = parseJSON(pass1.content[0].text);
    if (!result.html || !result.fields) throw new Error("AI response missing html or fields");

    // ========== PASS 2: Self-review and fix ==========
    // Render the HTML with fields filled in for review
    let rendered = result.html;
    Object.entries(result.fields).forEach(([k, v]) => {
      rendered = rendered.replaceAll(`{{${k}}}`, v || "");
    });

    const reviewPrompt = `You are reviewing an ad you just created. Here is the generated HTML:

${rendered}

And here is the reference image it was supposed to match.

Score these 1-10:
1. LAYOUT MATCH: Does the HTML match the reference's structure exactly? Same number of columns, rows, sections, same proportions?
2. VISUAL QUALITY: Does it look professional? Good typography, spacing, color usage?
3. TEXT READABILITY: Is all text properly sized, not cramped, not overflowing?

If ANY score is below 7, you MUST rewrite the HTML to fix the issues. The #1 priority is matching the reference layout structure exactly.

Return ONLY valid JSON:
{"scores": {"layout": N, "quality": N, "readability": N}, "fixed": true/false, "html": "...(improved HTML with {{token}} placeholders)...", "fields": {...}, "backgroundColor": "#hex", "textColor": "#hex", "accentColor": "#hex"}

If no fixes needed, return the same html/fields unchanged with "fixed": false.`;

    try {
      const pass2 = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } },
            { type: "text", text: reviewPrompt },
          ],
        }],
      });

      const review = parseJSON(pass2.content[0].text);
      if (review.fixed && review.html && review.fields) {
        result = { html: review.html, fields: review.fields, backgroundColor: review.backgroundColor || result.backgroundColor, textColor: review.textColor || result.textColor, accentColor: review.accentColor || result.accentColor };
      }
    } catch (reviewErr) {
      console.error("Self-review failed (using pass 1 result):", reviewErr.message);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recreate error:", error);
    return NextResponse.json({ error: error.message || "Failed to recreate ad" }, { status: 500 });
  }
}
