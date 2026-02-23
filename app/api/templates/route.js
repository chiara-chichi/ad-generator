import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/templates
 * Returns active Creatomate templates from the registry.
 * Optional query params: ?category=hero-product&width=1080&height=1080
 */
export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const width = searchParams.get("width");
    const height = searchParams.get("height");

    let query = supabaseAdmin
      .from("creatomate_templates")
      .select("*")
      .eq("is_active", true)
      .order("category")
      .order("name");

    if (category) query = query.eq("category", category);
    if (width) query = query.eq("width", parseInt(width));
    if (height) query = query.eq("height", parseInt(height));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ templates: data || [] });
  } catch (error) {
    console.error("Fetch templates error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
