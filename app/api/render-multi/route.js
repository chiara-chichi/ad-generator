import { NextResponse } from "next/server";
import { renderByTag } from "@/lib/creatomate";

/**
 * POST /api/render-multi
 * Renders all Creatomate templates matching the given tags with the same modifications.
 * Used for multi-size rendering (e.g., same ad in 1080x1080, 1080x1920, 1200x628).
 */
export async function POST(request) {
  try {
    const { tags, modifications, outputFormat } = await request.json();

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: "No tags provided" },
        { status: 400 }
      );
    }

    const renders = await renderByTag(tags, modifications || {}, {
      outputFormat: outputFormat || "png",
    });

    if (!renders || renders.length === 0) {
      return NextResponse.json({
        renders: [],
        message: "No templates matched the given tags",
      });
    }

    return NextResponse.json({
      renders: renders.map((r) => ({
        url: r.url,
        width: r.width,
        height: r.height,
        templateId: r.templateId,
        templateName: r.templateName,
      })),
    });
  } catch (error) {
    console.error("Multi-render error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to render multiple sizes" },
      { status: 500 }
    );
  }
}
