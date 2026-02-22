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
    const { description, adWidth, adHeight, flavor, channel } = await request.json();

    if (!description) {
      return NextResponse.json({ error: "No description provided" }, { status: 400 });
    }

    const product = brandContext.products?.find((p) => p.flavor === flavor);

    // ========== PASS 1: Generate the ad ==========
    const generatePrompt = `You are a top creative director designing a ${adWidth}x${adHeight}px ad for ChiChi Foods.

BRAND: ${brandContext.brand.name} — ${brandContext.brand.tagline} | ${brandContext.brand.website}
VOICE: ${brandContext.voice.qualities.join(", ")}
BRAND COLORS (use ONLY these): ${getBrandColors()}
FONTS: "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body.
KEY SELLING POINTS: ${brandContext.sellingPoints.slice(0, 5).join("; ")}
${product ? `PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein, ${product.calories} cal)` : ""}
${channel ? `CHANNEL: ${channel}` : ""}

${QUALITY_GUIDELINES}

BRIEF: "${description}"

Create a scroll-stopping ad. Make it look like a real ad from a professional agency — not generic AI output.
ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal.
Only include <img> tags if the user provided image URLs.
All styling inline. No <style> tags. Use {{token_name}} for all text.

Return ONLY valid JSON:
{"html": "<div style='width:${adWidth}px;height:${adHeight}px;...'>...</div>", "fields": {"token": "value"}, "backgroundColor": "#hex", "textColor": "#hex", "accentColor": "#hex"}`;

    const pass1 = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: generatePrompt }],
    });

    let result = parseJSON(pass1.content[0].text);
    if (!result.html || !result.fields) throw new Error("AI response missing html or fields");

    // ========== PASS 2: Self-review and fix ==========
    let rendered = result.html;
    Object.entries(result.fields).forEach(([k, v]) => {
      rendered = rendered.replaceAll(`{{${k}}}`, v || "");
    });

    const reviewPrompt = `You just designed this ad. Review it honestly.

HTML:
${rendered}

Score 1-10:
1. SCROLL-STOPPING: Would this make someone stop scrolling on Instagram?
2. VISUAL QUALITY: Does it look professional, polished, not like generic AI?
3. TEXT READABILITY: All text properly sized, not cramped, not overflowing?
4. MESSAGE CLARITY: Is there ONE clear message with a strong CTA?

If ANY score is below 7, rewrite the HTML to fix issues. Keep the same {{token}} placeholder system.

Return ONLY valid JSON:
{"scores": {"impact": N, "quality": N, "readability": N, "clarity": N}, "fixed": true/false, "html": "...", "fields": {...}, "backgroundColor": "#hex", "textColor": "#hex", "accentColor": "#hex"}

If no fixes needed, return same html/fields with "fixed": false.`;

    try {
      const pass2 = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: reviewPrompt }],
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
    console.error("Generate ad error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate ad" }, { status: 500 });
  }
}
