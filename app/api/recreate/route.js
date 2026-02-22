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

function extractHtml(text) {
  // Strip markdown fences if model wrapped it
  let html = text.trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  // If model returned JSON anyway, extract html field
  if (html.startsWith("{")) {
    try {
      const obj = JSON.parse(html);
      if (obj.html) return obj.html;
    } catch {}
  }
  return html;
}

export async function POST(request) {
  try {
    const { imageBase64, mediaType, adWidth, adHeight, userNotes, assets, flavor, channel } =
      await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const product = brandContext.products?.find((p) => p.flavor === flavor);
    const hasAssets = assets && assets.length > 0;

    // ============ STEP 1: Generate raw HTML (layout-focused) ============

    const systemMessage = `You recreate ads as HTML. Output ${adWidth}x${adHeight}px. Inline styles only. No <style> tags. Fonts: "Decoy", serif for headlines, "Questa Sans", sans-serif for body. Return ONLY the HTML, no markdown fences.`;

    const assetLines = hasAssets
      ? `\nUse these product images: ${assets.map(a => `<img src="${a.url}" crossorigin="anonymous" />`).join(" ")}`
      : "";

    const userMessage = `Recreate this exact ad for ChiChi Foods (chickpea protein hot cereal). Same layout, same proportions, same design — just swap the brand.

ChiChi brand colors: ${getBrandColors()}
Flavors: Peanut Butter Chip, Apple Cinnamon, Dark Chocolate, Maple Brown Sugar
${product ? `Product: ${product.name} (${product.protein} protein)` : ""}${assetLines}${userNotes ? `\n${userNotes}` : ""}`;

    const pass1 = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 10000 },
      system: systemMessage,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/png", data: imageBase64 } },
          { type: "text", text: userMessage },
        ],
      }],
    });

    const textBlock1 = pass1.content.find(b => b.type === "text");
    if (!textBlock1) throw new Error("No response from AI");

    const rawHtml = extractHtml(textBlock1.text);

    // ============ STEP 2: Tokenize the HTML (cheap, no image) ============

    const tokenizePrompt = `Take this ad HTML and replace all user-visible text content with {{token_name}} placeholders. Also extract the dominant colors.

HTML:
${rawHtml}

RULES:
- Replace each text string with a descriptive {{token_name}} (e.g. {{headline}}, {{subheadline}}, {{cta_text}}, {{flavor_1}}, {{badge_text}}, etc.)
- Do NOT change ANY styles, structure, layout, or attributes
- Do NOT change image src URLs
- Do NOT add or remove any HTML elements
- Just swap the text content for tokens

Return ONLY valid JSON:
{"html": "<the HTML with {{token}} placeholders>", "fields": {"token_name": "original text value", ...}, "backgroundColor": "#hex", "textColor": "#hex", "accentColor": "#hex"}`;

    const pass2 = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: tokenizePrompt }],
    });

    const textBlock2 = pass2.content.find(b => b.type === "text");
    if (!textBlock2) throw new Error("Tokenization failed");

    const result = parseJSON(textBlock2.text);
    if (!result.html || !result.fields) throw new Error("AI response missing html or fields");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recreate error:", error);
    return NextResponse.json({ error: error.message || "Failed to recreate ad" }, { status: 500 });
  }
}
