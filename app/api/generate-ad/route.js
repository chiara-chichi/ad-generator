import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildBrandPrompt, brandContext } from "@/lib/brand-context";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

    const product = brandContext.products?.find((p) => p.flavor === flavor);

    const prompt = `You are a world-class graphic designer and copywriter for ChiChi Foods.

BRAND CONTEXT:
${buildBrandPrompt()}

YOUR TASK:
Design a stunning ${adWidth}x${adHeight}px ad for ChiChi Foods based on this brief:
"${description}"

DESIGN RULES:
1. Be CREATIVE with the layout. Use grids, bold typography, creative compositions, geometric shapes, color blocks, overlapping elements. Don't just stack a headline and button — make it visually striking.
2. USE ONLY CHICHI BRAND COLORS: ${brandColorsList.join(", ")}. Create a vibrant, eye-catching palette from these.
3. FONTS: "Decoy, serif" for headlines/display text, "Questa Sans, sans-serif" for body text.
4. The root <div> must be EXACTLY ${adWidth}px wide and ${adHeight}px tall with overflow:hidden and position:relative.
5. ALL styling must be inline. No <style> tags, no CSS classes.
6. Use {{token_name}} placeholders for ALL text content.
7. Only include image placeholders if the user specifically mentioned images/photos.
8. Write punchy, on-brand copy. Lead with taste and experience, then nutrition facts. ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal.
9. Make it look like a real professional ad — proper spacing, alignment, visual hierarchy.
10. Think about what would make someone stop scrolling.
${product ? `\nFEATURED PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein, ${product.calories} cal)` : ""}
${channel ? `\nCHANNEL: ${channel} — optimize the design for this platform.` : ""}

Return ONLY valid JSON (no markdown fences, no explanation, no comments):
{
  "html": "<div style='width:${adWidth}px;height:${adHeight}px;position:relative;overflow:hidden;...'>...{{token}} placeholders...</div>",
  "fields": {
    "token_name": "actual text value for each token"
  },
  "backgroundColor": "#hex",
  "textColor": "#hex",
  "accentColor": "#hex"
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
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
    console.error("Generate ad error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate ad" },
      { status: 500 }
    );
  }
}
