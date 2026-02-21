import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !url.startsWith("http") || !key) {
    return null;
  }
  return createClient(url, key);
}

export async function GET(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ assets: [] });
    }
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    let query = supabase
      .from("brand_assets")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ assets: data });
  } catch (error) {
    console.error("Get assets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch assets" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const category = formData.get("category") || "other";
    const name = formData.get("name") || file.name;
    const flavor = formData.get("flavor") || null;
    const sku = formData.get("sku") || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop();
    const storagePath = `${category}/${Date.now()}-${file.name}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(storagePath);

    // Save to database
    const { data, error: dbError } = await supabase
      .from("brand_assets")
      .insert({
        category,
        name,
        file_name: file.name,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        mime_type: file.type,
        tags: [],
        sku,
        flavor,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ asset: data });
  } catch (error) {
    console.error("Upload asset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload asset" },
      { status: 500 }
    );
  }
}

// Update asset name and/or category
export async function PATCH(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    const { id, name, category } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "No asset ID provided" }, { status: 400 });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("brand_assets")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ asset: data });
  } catch (error) {
    console.error("Update asset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update asset" },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }
    const { id, storagePath } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "No asset ID provided" }, { status: 400 });
    }

    // Delete from storage
    if (storagePath) {
      await supabase.storage.from("brand-assets").remove([storagePath]);
    }

    // Delete from database
    const { error } = await supabase
      .from("brand_assets")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete asset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete asset" },
      { status: 500 }
    );
  }
}
