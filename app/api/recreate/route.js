import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";
import { renderTemplate } from "@/lib/creatomate";
import { supabaseAdmin } from "@/lib/supabase";

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

function getBrandColors() {
  const list = [];
  if (brandContext.colors?.primary)
    Object.entries(brandContext.colors.primary).forEach(([n, h]) =>
      list.push(`${n}: ${h}`)
    );
  if (brandContext.colors?.pairings)
    Object.entries(brandContext.colors.pairings).forEach(([n, h]) =>
      list.push(`${n}: ${h}`)
    );
  return list.join(", ");
}

function buildTemplateCatalog(templates) {
  if (!templates || templates.length === 0) {
    return "No templates available.";
  }

  return templates
    .map((t, i) => {
      const fields = Object.entries(t.editable_fields || {})
        .map(([name, def]) => `${name} (${def.type})`)
        .join(", ");

      return `${i + 1}. "${t.name}" (ID: ${t.creatomate_id}) — ${t.description || t.category}
   Size: ${t.width}x${t.height} | Category: ${t.category}
   Editable fields: ${fields || "none specified"}`;
    })
    .join("\n\n");
}

export async function POST(request) {
  try {
    const {
      imageBase64,
      mediaType,
      adWidth,
      adHeight,
      userNotes,
      assets,
      flavor,
      channel,
    } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Fetch available templates
    let templates = [];
    if (supabaseAdmin) {
      // Try exact size first
      const { data } = await supabaseAdmin
        .from("creatomate_templates")
        .select("*")
        .eq("is_active", true)
        .eq("width", adWidth)
        .eq("height", adHeight);
      templates = data || [];
    }
    if (templates.length === 0 && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("creatomate_templates")
        .select("*")
        .eq("is_active", true);
      templates = data || [];
    }

    if (templates.length === 0) {
      return NextResponse.json(
        {
          error:
            "No Creatomate templates available. Design templates in Creatomate and run POST /api/templates/sync first.",
        },
        { status: 400 }
      );
    }

    const product = brandContext.products?.find((p) => p.flavor === flavor);
    const hasAssets = assets && assets.length > 0;
    const catalog = buildTemplateCatalog(templates);

    const assetLines = hasAssets
      ? `\nAvailable product images to use:\n${assets.map((a) => `- ${a.category || "image"}: ${a.url} (${a.name})`).join("\n")}`
      : "";

    // ========== Claude: Analyze reference + pick template + generate copy ==========
    const prompt = `You are a creative director for ChiChi Foods. Analyze this reference ad image, then pick the Creatomate template that BEST matches its layout/style, and generate ChiChi brand copy to fill that template.

BRAND: ${brandContext.brand.name} — ${brandContext.brand.tagline}
VOICE: ${brandContext.voice.qualities.join(", ")}
BRAND COLORS: ${getBrandColors()}
KEY SELLING POINTS: ${brandContext.sellingPoints.slice(0, 5).join("; ")}
${product ? `PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein, ${product.calories} cal)` : ""}
${channel ? `CHANNEL: ${channel}` : ""}${assetLines}${userNotes ? `\nUSER NOTES: ${userNotes}` : ""}

IMPORTANT: ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal.

AVAILABLE TEMPLATES:
${catalog}

INSTRUCTIONS:
1. Analyze the reference ad: What's the layout? (hero, split, grid, bold text, etc.) What's the visual style?
2. Pick the template that most closely matches the reference layout.
3. Fill in all editable fields with ChiChi-branded copy that captures the spirit of the reference.
4. For text fields: write punchy, on-brand copy. Lead with taste, follow with nutrition.
5. For color fields: use ChiChi brand colors that best match the reference ad's color mood.
6. For image fields: use provided asset URLs if available, otherwise null.

Return ONLY valid JSON (no markdown fences):
{
  "templateId": "the creatomate_id",
  "templateName": "name of the template",
  "modifications": { "FieldName": "value for each field" },
  "analysis": "1-2 sentences describing the reference ad layout and how the template matches"
}`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      thinking: { type: "enabled", budget_tokens: 8000 },
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
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No response from AI");

    const result = parseJSON(textBlock.text);

    if (!result.templateId || !result.modifications) {
      throw new Error("AI response missing templateId or modifications");
    }

    // Verify the chosen template exists
    const chosenTemplate = templates.find(
      (t) => t.creatomate_id === result.templateId
    );
    if (!chosenTemplate) {
      throw new Error(
        `AI chose template ${result.templateId} which doesn't exist`
      );
    }

    // ========== Render via Creatomate ==========
    const renders = await renderTemplate(
      result.templateId,
      result.modifications
    );

    if (!renders || renders.length === 0) {
      throw new Error("Creatomate returned no renders");
    }

    return NextResponse.json({
      renderUrl: renders[0].url,
      templateId: result.templateId,
      templateName: result.templateName || chosenTemplate.name,
      modifications: result.modifications,
      editableFields: chosenTemplate.editable_fields,
      width: renders[0].width || chosenTemplate.width,
      height: renders[0].height || chosenTemplate.height,
      analysis: result.analysis,
    });
  } catch (error) {
    console.error("Recreate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to recreate ad" },
      { status: 500 }
    );
  }
}
