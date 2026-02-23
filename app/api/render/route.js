import { NextResponse } from "next/server";
import { renderTemplate } from "@/lib/creatomate";

/**
 * POST /api/render
 * Renders a Creatomate template with the given modifications.
 * Used for re-renders after manual field edits (no Claude involved).
 */
export async function POST(request) {
  try {
    const { templateId, modifications, outputFormat } = await request.json();

    if (!templateId) {
      return NextResponse.json(
        { error: "No template ID provided" },
        { status: 400 }
      );
    }

    const renders = await renderTemplate(templateId, modifications || {}, {
      outputFormat: outputFormat || "png",
    });

    if (!renders || renders.length === 0) {
      throw new Error("Creatomate returned no renders");
    }

    return NextResponse.json({
      renderUrl: renders[0].url,
      snapshotUrl: renders[0].snapshotUrl || null,
      width: renders[0].width,
      height: renders[0].height,
    });
  } catch (error) {
    console.error("Render error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to render template" },
      { status: 500 }
    );
  }
}
