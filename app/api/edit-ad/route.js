import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { currentHtml, instruction, adWidth, adHeight } =
      await request.json();

    if (!currentHtml || !instruction) {
      return NextResponse.json(
        { error: "Missing currentHtml or instruction" },
        { status: 400 }
      );
    }

    const brandColorsList = [];
    if (brandContext.colors?.primary) {
      Object.entries(brandContext.colors.primary).forEach(([name, hex]) => {
        brandColorsList.push(`${name}: ${hex}`);
      });
    }
    if (brandContext.colors?.pairings) {
      Object.entries(brandContext.colors.pairings).forEach(([name, hex]) => {
        brandColorsList.push(`${name}: ${hex}`);
      });
    }

    const prompt = `You are editing an HTML ad for ChiChi Foods.

BRAND COLORS: ${brandColorsList.join(", ")}
BRAND FONTS: "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body.

Here is the CURRENT ad HTML (${adWidth}x${adHeight}px):
${currentHtml}

THE USER WANTS THIS CHANGE:
"${instruction}"

Apply EXACTLY what the user asked for. Keep everything else the same unless the change logically requires adjusting other elements for visual consistency.

RULES:
1. Only change what the user asked for.
2. Keep all inline styles. No <style> tags or classes.
3. The ad must remain EXACTLY ${adWidth}px wide and ${adHeight}px tall.
4. Use {{token_name}} placeholders for ALL text content.
5. When adding/changing colors, prefer ChiChi brand colors.
6. Preserve all existing layout structure unless the user explicitly asked to change it.
7. Any <img> tags must include crossorigin="anonymous".

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "html": "<the modified HTML with {{token}} placeholders>",
  "fields": { "token_name": "text value for each token" }
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text;
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          result = JSON.parse(objMatch[0]);
        } else {
          throw new Error("Could not parse AI response");
        }
      }
    }

    if (!result.html || !result.fields) {
      throw new Error("AI response missing html or fields");
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Edit ad error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to edit ad" },
      { status: 500 }
    );
  }
}
