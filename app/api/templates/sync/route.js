import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY;

/**
 * POST /api/templates/sync
 * Fetches all templates from the Creatomate API and upserts them
 * into the creatomate_templates Supabase table.
 *
 * Call this after designing new templates in Creatomate's editor.
 * Optional body: { editableFields: { "template-id": { ... } } }
 * to manually specify editable field definitions.
 */
export async function POST(request) {
  try {
    if (!CREATOMATE_API_KEY) {
      return NextResponse.json(
        { error: "CREATOMATE_API_KEY not set" },
        { status: 500 }
      );
    }
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Optional: caller can pass editable field definitions per template
    let manualFields = {};
    try {
      const body = await request.json();
      manualFields = body.editableFields || {};
    } catch {
      // No body — that's fine
    }

    // Fetch templates from Creatomate REST API
    const res = await fetch("https://api.creatomate.com/v1/templates", {
      headers: {
        Authorization: `Bearer ${CREATOMATE_API_KEY}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Creatomate API error ${res.status}: ${errText}`);
    }

    const templates = await res.json();

    if (!Array.isArray(templates) || templates.length === 0) {
      return NextResponse.json({
        synced: 0,
        message: "No templates found in Creatomate account",
      });
    }

    // Upsert each template into Supabase
    let synced = 0;
    const errors = [];

    for (const tmpl of templates) {
      try {
        // Try to infer editable fields from the template source
        const editableFields =
          manualFields[tmpl.id] || inferEditableFields(tmpl.source);

        // Infer category from template name or tags
        const category = inferCategory(tmpl.name, tmpl.tags);

        const row = {
          creatomate_id: tmpl.id,
          name: tmpl.name || "Untitled",
          description: tmpl.description || null,
          category,
          width: tmpl.width || 1080,
          height: tmpl.height || 1080,
          tags: tmpl.tags || [],
          editable_fields: editableFields,
          preview_url: tmpl.preview_url || tmpl.snapshot_url || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabaseAdmin
          .from("creatomate_templates")
          .upsert(row, { onConflict: "creatomate_id" });

        if (upsertError) throw upsertError;
        synced++;
      } catch (err) {
        errors.push({ templateId: tmpl.id, error: err.message });
      }
    }

    return NextResponse.json({
      synced,
      total: templates.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Template sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync templates" },
      { status: 500 }
    );
  }
}

/**
 * Attempt to infer editable fields from a Creatomate template source.
 * The source is a JSON tree describing the template's elements.
 */
function inferEditableFields(source) {
  const fields = {};
  if (!source) return fields;

  function walk(node) {
    if (!node) return;

    // Named elements are the ones that can be targeted via modifications
    const name = node.name;
    if (name) {
      if (node.type === "text" || node.text !== undefined) {
        fields[name] = {
          type: "text",
          default: node.text || "",
        };
      } else if (
        node.type === "image" ||
        node.type === "video" ||
        node.source !== undefined
      ) {
        fields[name] = {
          type: "image",
          default: node.source || null,
        };
      } else if (node.type === "shape" || node.fill_color !== undefined) {
        fields[name] = {
          type: "color",
          property: "fill_color",
          default: node.fill_color || null,
        };
      }
    }

    // Recurse into child elements
    if (Array.isArray(node.elements)) {
      node.elements.forEach(walk);
    }
  }

  // source can be an object or array
  if (Array.isArray(source)) {
    source.forEach(walk);
  } else {
    walk(source);
  }

  return fields;
}

/**
 * Infer a category from the template name and tags.
 */
function inferCategory(name, tags) {
  const lower = (name || "").toLowerCase();
  const tagStr = (tags || []).join(" ").toLowerCase();
  const combined = `${lower} ${tagStr}`;

  if (combined.includes("hero") || combined.includes("product"))
    return "hero-product";
  if (combined.includes("lifestyle") || combined.includes("overlay"))
    return "lifestyle-overlay";
  if (combined.includes("split")) return "split-layout";
  if (combined.includes("bold") || combined.includes("typo"))
    return "bold-typography";
  if (combined.includes("grid")) return "grid";
  if (combined.includes("collage")) return "collage";
  if (combined.includes("promo") || combined.includes("sale")) return "promo";

  return "other";
}
