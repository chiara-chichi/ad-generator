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

export async function POST(request) {
  try {
    const { templateId, modifications, editableFields, instruction } =
      await request.json();

    if (!templateId || !instruction) {
      return NextResponse.json(
        { error: "Missing templateId or instruction" },
        { status: 400 }
      );
    }

    // Build current modifications into a readable list
    const currentValues = Object.entries(modifications || {})
      .map(([key, val]) => `- ${key}: "${val}"`)
      .join("\n");

    const fieldDefs = Object.entries(editableFields || {})
      .map(([key, def]) => `- ${key} (${def.type})`)
      .join("\n");

    // Fetch all templates in case Claude needs to switch
    let templateCatalog = "";
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from("creatomate_templates")
        .select("*")
        .eq("is_active", true);

      if (data && data.length > 0) {
        templateCatalog = data
          .map((t) => {
            const fields = Object.entries(t.editable_fields || {})
              .map(([name, def]) => `${name} (${def.type})`)
              .join(", ");
            return `"${t.name}" (ID: ${t.creatomate_id}) — ${t.description || t.category} | Fields: ${fields}`;
          })
          .join("\n");
      }
    }

    const prompt = `You are editing an ad for ChiChi Foods. The ad uses a Creatomate template with editable fields.

BRAND COLORS: ${getBrandColors()}

CURRENT TEMPLATE ID: ${templateId}
CURRENT FIELD VALUES:
${currentValues}

AVAILABLE FIELDS ON THIS TEMPLATE:
${fieldDefs}

${templateCatalog ? `OTHER AVAILABLE TEMPLATES (use only if the user wants a completely different layout):\n${templateCatalog}` : ""}

THE USER WANTS THIS CHANGE:
"${instruction}"

INSTRUCTIONS:
1. If this is a copy/text change: update the relevant text field(s) in modifications.
2. If this is a color change: update the relevant color field(s). Use ChiChi brand colors.
3. If this requires a completely different layout: pick a new template from the catalog and fill in ALL its fields.
4. Keep all other field values unchanged unless the edit logically requires adjusting them.
5. ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal.

Return ONLY valid JSON (no markdown fences):
{
  "templateId": "${templateId}",
  "modifications": { "FieldName": "value for each field" },
  "templateChanged": false
}

If you switch to a different template, set templateChanged to true and use the new templateId.`;

    const response = await getClient().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const result = parseJSON(response.content[0].text);

    if (!result.templateId || !result.modifications) {
      throw new Error("AI response missing templateId or modifications");
    }

    // If template changed, fetch the new template's editable fields
    let newEditableFields = editableFields;
    if (
      result.templateChanged &&
      result.templateId !== templateId &&
      supabaseAdmin
    ) {
      const { data } = await supabaseAdmin
        .from("creatomate_templates")
        .select("editable_fields, name")
        .eq("creatomate_id", result.templateId)
        .single();

      if (data) {
        newEditableFields = data.editable_fields;
      }
    }

    // Render via Creatomate
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
      modifications: result.modifications,
      editableFields: newEditableFields,
      templateChanged: result.templateChanged || false,
      width: renders[0].width,
      height: renders[0].height,
    });
  } catch (error) {
    console.error("Edit ad error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to edit ad" },
      { status: 500 }
    );
  }
}
