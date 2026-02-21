import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { buildBrandPrompt, brandContext } from "@/lib/brand-context";

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

    const prompt = `You are an expert graphic designer recreating an ad for ChiChi Foods.

BRAND CONTEXT:
${buildBrandPrompt()}

YOUR TASK:
Look at this reference ad image and recreate its EXACT layout as HTML/CSS, but rebranded for ChiChi Foods.

STRICT RULES:
1. RECREATE THE EXACT LAYOUT — same grid structure, same number of sections, same visual hierarchy, same spacing patterns. If it has 6 boxes in a 2x3 grid, make 6 boxes in a 2x3 grid. If it has a diagonal stripe, make a diagonal stripe. Be precise.
2. USE ONLY CHICHI BRAND COLORS: ${brandColorsList.join(", ")}. Map the reference colors to the closest ChiChi brand colors. Do NOT use the reference's original colors.
3. FONTS: "Decoy, serif" for bold headlines/titles, "Questa Sans, sans-serif" for body/description text.
4. The root <div> must be EXACTLY ${adWidth}px wide and ${adHeight}px tall with overflow:hidden and position:relative.
5. ALL styling must be inline. No <style> tags, no CSS classes.
6. Use {{token_name}} placeholders for ALL text content. Use descriptive names like {{headline}}, {{box_1_title}}, {{box_1_desc}}, {{box_2_title}}, {{box_2_desc}}, {{cta}}, etc.
7. DO NOT add product images, image tags, or image placeholders unless the reference CLEARLY features a photograph or illustration. Text-only ads should remain text-only.
8. ChiChi makes CHICKPEA protein hot cereal, NOT oatmeal. Never say oatmeal.
9. Make borders, spacing, and alignment look clean and professional.
10. If the reference uses rounded corners, shadows, gradients, or decorative elements — recreate those.

AD PERFORMANCE OPTIMIZATION (apply these automatically while staying faithful to the reference layout):
- Ensure ONE clear visual hook that grabs attention instantly — bold headline, striking color contrast, or dramatic typography
- Text must be readable on mobile — minimum 14px for body, 24px+ for headlines at 1080px width
- CTA should be prominent, action-oriented, and high-contrast against its background
- Respect the ~20% text rule for Meta/Instagram ads — balance text with visual breathing room
- Strong visual hierarchy: hook → benefit → CTA
- Use whitespace intentionally — avoid overcrowding sections
- Brand name should be visible but not dominating
Do NOT change the reference layout structure — just make it perform better within that structure.
${userNotes ? `\nUSER DIRECTION: "${userNotes}"\nCRITICAL: If the user provided specific text content for sections, use their EXACT text as the field values. Do not rewrite what they gave you.` : ""}
${product ? `\nFEATURED PRODUCT: ${product.name} — ${product.keyBenefit} (${product.protein} protein)` : ""}

Return ONLY valid JSON (no markdown fences, no explanation, no comments):
{
  "html": "<div style='width:${adWidth}px;height:${adHeight}px;position:relative;overflow:hidden;...'>...{{token}} placeholders for all text...</div>",
  "fields": {
    "token_name": "actual text value for each token used in html"
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
      // Try extracting from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find a JSON object
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
