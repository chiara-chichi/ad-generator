import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildBrandPrompt, brandContext } from "@/lib/brand-context";
import { buildDesignSystemPrompt } from "@/lib/design-system";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { imageBase64, mediaType, adWidth, adHeight, userNotes, flavor, channel } =
      await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
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

    const prompt = `You are a senior graphic designer at a top creative agency, recreating an ad for ChiChi Foods.

BRAND CONTEXT:
${buildBrandPrompt()}

AVAILABLE BRAND COLORS (use ONLY these): ${brandColorsList.join(", ")}

${buildDesignSystemPrompt()}

YOUR TASK:
Look at this reference ad image and recreate its layout as HTML/CSS, rebranded for ChiChi Foods.
The ad must be EXACTLY ${adWidth}px wide and ${adHeight}px tall.

REFERENCE RECREATION RULES:
1. MATCH THE REFERENCE LAYOUT — same grid structure, same number of sections, same visual hierarchy, same spacing patterns. If it has 6 boxes in a 2x3 grid, make 6 boxes in a 2x3 grid. If it has a diagonal stripe, make a diagonal stripe.
2. USE ONLY CHICHI BRAND COLORS listed above. Map the reference colors to the closest ChiChi brand colors. Do NOT use the reference's original colors.
3. While matching the layout, ELEVATE the visual quality: add the polish techniques from the design rules (shadows, gradients, decorative elements, proper typography). Make it BETTER than the reference, not just a copy.
4. The root <div> must be EXACTLY ${adWidth}px wide and ${adHeight}px tall with overflow:hidden and position:relative.
5. ALL styling must be inline. No <style> tags, no CSS classes.
6. Use {{token_name}} placeholders for ALL text content. Use descriptive names like {{headline}}, {{box_1_title}}, {{box_1_desc}}, {{cta}}, etc.
7. DO NOT add product images, image tags, or image placeholders unless the reference CLEARLY features a photograph or illustration. Text-only ads should remain text-only.
8. ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal. Never say oatmeal.
${userNotes ? `\nUSER DIRECTION: "${userNotes}"\nCRITICAL: If the user provided specific text content, use their EXACT text as the field values. Do not rewrite it.` : ""}
${product ? `\nFEATURED PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein)` : ""}

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "design_rationale": {
    "aesthetic": "description of visual style",
    "layout_technique": "what makes layout interesting",
    "color_strategy": "which brand colors and how",
    "polish_techniques": ["technique1", "technique2", "technique3"]
  },
  "html": "<div style='width:${adWidth}px;height:${adHeight}px;position:relative;overflow:hidden;...'>...{{token}} placeholders...</div>",
  "fields": {
    "token_name": "actual text value"
  },
  "backgroundColor": "#hex",
  "textColor": "#hex",
  "accentColor": "#hex"
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
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
            {
              type: "text",
              text: prompt,
            },
          ],
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
    console.error("Recreate error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to recreate ad" },
      { status: 500 }
    );
  }
}
