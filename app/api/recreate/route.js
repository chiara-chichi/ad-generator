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

    const systemMessage = `You are an expert HTML/CSS developer who recreates advertisement layouts with pixel-perfect accuracy.

TECHNICAL RULES:
- Output a single <div> element with inline styles, exactly ${adWidth}x${adHeight}px
- All styles must be inline (no <style> tags, no CSS classes)
- Use overflow:hidden on text containers
- For fonts, match the VISUAL STYLE of the reference (bold weight, size, serif vs sans-serif). Use web-safe fonts (Georgia, Arial Black, Impact, Trebuchet MS, etc.) or Google Fonts via <link> in the HTML. Pick fonts that look like the reference — do NOT use "Decoy" or "Questa Sans" as they are not loaded.
${hasAssets
  ? `- For product images, use the provided <img> URLs with crossorigin="anonymous"`
  : `- For product images/packaging, use colored <div> shapes as placeholders (same size and position as in the reference)`}
- Write the actual text content directly in the HTML (do NOT use placeholder tokens like {{...}})

OUTPUT: Return ONLY the raw HTML. No JSON wrapping, no markdown fences, no explanation.`;

    const assetLines = hasAssets
      ? `\n\nBrand asset images to use:\n${assets.map(a => `- ${a.category || "product"}: <img src="${a.url}" crossorigin="anonymous" />`).join("\n")}`
      : "";

    const userMessage = `Recreate this ad for ChiChi Foods (chickpea protein hot cereal, NOT oatmeal).

Keep the EXACT same layout, proportions, and visual structure. Just swap the branding:
- Brand: ChiChi | chickpeaoats.com
- Colors: ${getBrandColors()}
- Flavors: Peanut Butter Chip, Apple Cinnamon, Dark Chocolate, Maple Brown Sugar
${product ? `- Product: ${product.name} (${product.protein} protein)` : ""}${assetLines}${userNotes ? `\n\nNotes: "${userNotes}"` : ""}`;

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
