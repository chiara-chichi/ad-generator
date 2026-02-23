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

/**
 * Build a text catalog of available templates for Claude's prompt.
 */
function buildTemplateCatalog(templates) {
  if (!templates || templates.length === 0) {
    return "No templates available. Return an error.";
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
    const { description, adWidth, adHeight, flavor, channel } =
      await request.json();

    if (!description) {
      return NextResponse.json(
        { error: "No description provided" },
        { status: 400 }
      );
    }

    // Fetch available templates matching the requested size
    let templates = [];
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("creatomate_templates")
        .select("*")
        .eq("is_active", true)
        .eq("width", adWidth)
        .eq("height", adHeight);
      templates = data || [];
    }

    // If no exact size match, fetch all templates
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
    const catalog = buildTemplateCatalog(templates);

    // ========== Claude: Pick template + generate copy ==========
    const prompt = `You are a top creative director for ChiChi Foods. Given the ad brief below and the available templates, pick the BEST template and fill in ALL its editable fields with compelling, on-brand copy.

BRAND: ${brandContext.brand.name} — ${brandContext.brand.tagline} | ${brandContext.brand.website}
VOICE: ${brandContext.voice.qualities.join(", ")}
BRAND COLORS: ${getBrandColors()}
KEY SELLING POINTS: ${brandContext.sellingPoints.slice(0, 5).join("; ")}
${product ? `PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein, ${product.calories} cal)` : ""}
${channel ? `CHANNEL: ${channel}` : ""}

IMPORTANT: ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal. Never say "oatmeal."

AVAILABLE TEMPLATES:
${catalog}

AD BRIEF: "${description}"

INSTRUCTIONS:
1. Pick the template whose layout best matches the brief.
2. For each editable text field, write punchy on-brand copy. Lead with taste/experience, then nutrition.
3. For color fields, use ChiChi brand colors only.
4. For image fields, leave as null unless the brief includes specific image URLs.
5. Keep headlines short (max 8 words). CTAs should be 2-4 words.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "templateId": "the creatomate_id of your chosen template",
  "templateName": "name of the template",
  "modifications": {
    "FieldName": "value for each editable field"
  },
  "reasoning": "1 sentence explaining why you chose this template"
}`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const result = parseJSON(response.content[0].text);

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
    });
  } catch (error) {
    console.error("Generate ad error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate ad" },
      { status: 500 }
    );
  }
}
