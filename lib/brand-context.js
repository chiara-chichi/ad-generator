export const brandContext = {
  brand: {
    name: "ChiChi",
    fullName: "ChiChi Foods LLC",
    tagline: "Protein Hot Cereal",
    website: "chickpeaoats.com",
    shopUrl: "https://chickpeaoats.com",
    founded: "Co-founded by Chiara and Izzy in their college dorm",
    mission:
      "Two women on a mission to replace oats with chickpeas in the breakfast aisle. Revolutionizing breakfast with chickpeas, to fuel your mornings and heal our planet.",
    story:
      "ChiChi was born from a need for better breakfast. Most convenient options are high in sugar and carbs, but low in protein leading to energy crashes and mid-morning hunger. Even oatmeal falls short. Co-founders Chiara and Izzy tried adding protein powder to oats to make it more filling, but it didn't taste good or feel good. So they created something new: oats made out of chickpeas. What started as an experiment in their college dorm quickly proved effective and delicious. Today, ChiChi offers a high-protein, high-fiber breakfast that actually keeps you full using simple ingredients to fuel better mornings.",
  },

  voice: {
    description:
      "ChiChi's tone of voice is warm, upbeat, and approachable, always speaking like a trusted friend who knows what's good for you and isn't afraid to have a little fun. We're youthful and personable, but never unprofessional. Our messaging is designed to resonate with modern women and moms who are looking for nourishing, natural food that fits their lifestyle not a diet.",
    qualities: [
      "Casual",
      "Friendly",
      "Energetic",
      "Professional",
      "Conversational",
    ],
    guidelines: [
      "We're premium in quality, but inclusive in spirit",
      "Whether someone is gluten-free, dairy-free, plant-based, or just health-conscious, ChiChi speaks to them with encouragement, not judgment",
      "We don't push body ideals, we celebrate feeling good, fueling right, and making mornings easier for everyone",
      "Our voice is positive, empowering, and always family-friendly",
      "Good food should make everyone at the table feel welcome",
    ],
  },

  colors: {
    primary: {
      peach: "#f0615a",
      vanilla: "#fffbec",
      chocolate: "#4b1c10",
    },
    pairings: {
      sky: "#5dc5c6",
      teal: "#249b96",
      dragonFruit: "#9c2658",
      plum: "#4f1329",
      cinnamon: "#96402b",
      strawberry: "#de2740",
    },
  },

  fonts: {
    primary: "Decoy",
    secondary: "Questa Sans",
    accent1: "Questa Slab",
    accent2: "Tomarik Extrovert",
  },

  mascot: {
    name: "Peazy",
    description:
      "A fun, playful chickpea mascot who helps promote the brand. Peazy can be shown in many variations and the accent red color can be changed to any color in the palette.",
  },

  targetAudience: [
    {
      segment: "Middle aged, active women (30-35M)",
      traits: [
        "Gluten/dairy free",
        "Wants clean label",
        "Prioritizing protein",
      ],
    },
    {
      segment: "Millennial & Gen Z women (25-30M)",
      traits: ["Needs an easy option", "Adventurous", "Health-conscious"],
    },
    {
      segment: "Healthy 40+ year old men (~45-50M)",
      traits: [
        "Protein in every meal",
        "Quick for busy mornings",
        "Already eats oats",
      ],
    },
  ],

  products: [
    {
      sku: "PBC-CUP",
      name: "Peanut Butter Chip Cup",
      flavor: "Peanut Butter Chip",
      format: "Single-serve cup",
      protein: "14g",
      calories: "190",
      keyBenefit: "Peanut butter lovers dream breakfast",
    },
    {
      sku: "MBS-CUP",
      name: "Maple Brown Sugar Cup",
      flavor: "Maple Brown Sugar",
      format: "Single-serve cup",
      protein: "10g",
      calories: "180",
      keyBenefit: "Sweet maple warmth with a protein punch",
    },
    {
      sku: "AC-CUP",
      name: "Apple Cinnamon Cup",
      flavor: "Apple Cinnamon",
      format: "Single-serve cup",
      protein: "10g",
      calories: "190",
      keyBenefit: "Apple pie vibes, any morning",
    },
    {
      sku: "PBC-8OZ",
      name: "Peanut Butter Chip 8.8oz Pouch",
      flavor: "Peanut Butter Chip",
      format: "8.8oz pouch (~5 servings)",
      protein: "14g per serving",
      calories: "190",
      keyBenefit: "Family favorite",
    },
    {
      sku: "AC-8OZ",
      name: "Apple Cinnamon 8.8oz Pouch",
      flavor: "Apple Cinnamon",
      format: "8.8oz pouch (~5 servings)",
      protein: "10g per serving",
      calories: "190",
      keyBenefit: "Warm apple cinnamon in every bite",
    },
    {
      sku: "DC-8OZ",
      name: "Dark Chocolate 8.8oz Pouch",
      flavor: "Dark Chocolate",
      format: "8.8oz pouch (~5 servings)",
      protein: "10g per serving",
      calories: "190",
      keyBenefit: "Guilt-free chocolate for breakfast",
    },
    {
      sku: "MBS-8OZ",
      name: "Maple Brown Sugar 8.8oz Pouch",
      flavor: "Maple Brown Sugar",
      format: "8.8oz pouch (~5 servings)",
      protein: "10g per serving",
      calories: "180",
      keyBenefit: "Classic comfort, modern nutrition",
    },
    {
      sku: "OG-8OZ",
      name: "Original 8.8oz Pouch",
      flavor: "Original",
      format: "8.8oz pouch (~5 servings)",
      protein: "11g per serving",
      calories: "190",
      keyBenefit: "The one that started it all",
    },
    {
      sku: "OG-20OZ",
      name: "Original 20oz Bag",
      flavor: "Original",
      format: "20oz bag (~15 servings)",
      protein: "11g per serving",
      calories: "190",
      keyBenefit: "Best value, stock-up size",
    },
  ],

  sellingPoints: [
    "Made from chickpeas — not oats",
    "High protein (10-14g per serving)",
    "Ready in 2 minutes — just add hot water",
    "All natural, simple ingredients",
    "Gluten-free, grain-free, vegan",
    "High fiber",
    "Low glycemic",
    "No artificial anything",
    "Plant-based protein",
  ],

  microTrends: [
    { name: "Workout Girl", hook: "10-14g protein, all-natural, fuel your mornings" },
    { name: "Lazy Healthy", hook: "So easy, just add milk/water, microwave for 90 seconds" },
    { name: "Celiac", hook: "Completely gluten/grain free unlike other instant oats" },
    { name: "Moms", hook: "Cook in 2 min, don't say oatmeal, all natural simple ingredients" },
    { name: "Camper", hook: "ChiChi cooks on the fire, filling breakfast single serve" },
    { name: "Chickpea Lover", hook: "We make instant chickpea oatmeal — our plan is to replace all oats with chickpea flakes" },
    { name: "Diabetic", hook: "Delicious and healthy, low glycemic index of chickpeas" },
    { name: "Vegan", hook: "Plant-based, all natural and unprocessed, easy way to get protein" },
    { name: "Busy Professional", hook: "Say goodbye to your mid-morning sugar crash, healthier than oatmeal, full quick and delicious" },
    { name: "Vegan Athlete", hook: "10-14g unprocessed plant protein per serving" },
    { name: "Women with PCOS", hook: "Eating chickpeas daily can help relieve PCOS symptoms, high fiber, healthy plant protein" },
    { name: "Hormone Balance", hook: "Plant-based protein can help balance estrogen receptors, boost your hormone production with essential B vitamins" },
    { name: "Gut Friendly", hook: "Unprocessed natural protein source, aid digestion with fiber, support healthy gut by nourishing beneficial bacteria" },
    { name: "Glucose Goddess", hook: "Balance your glucose levels, high protein and fiber can help regulate glucose levels and avoid spikes" },
  ],

  channels: {
    dtc: {
      emphasis: "Convenience, taste, healthy lifestyle",
      cta: "Shop Now at chickpeaoats.com",
    },
    retail: {
      emphasis: "Find us in stores, try something new in the breakfast aisle",
      cta: "Find a Store Near You",
    },
    wholesale: {
      emphasis: "Growing brand, great margins, consumer demand",
      cta: "Contact Us for Wholesale",
    },
    social: {
      emphasis: "Relatable, fun, educational. Lead with taste, follow with nutrition",
      cta: "Try ChiChi Today",
    },
  },

  photoGuidelines: [
    "Always take one photo with a ChiChi bag and one without",
    "Avoid showing logos or brand names of other products",
    "Stick to simple, neutral bowls — they keep the focus on the food",
    "Texture is everything! That creamy, dreamy spoonful makes the shot",
    "Natural light is your best friend — lighter tones make ChiChi look more appealing",
    "Avoid dark or overly shadowy lighting — people are drawn to food that looks bright and fresh",
  ],
};

// Build a text prompt from brand context for Claude
export function buildBrandPrompt() {
  const b = brandContext;
  return `
BRAND: ${b.brand.name} — ${b.brand.tagline}
WEBSITE: ${b.brand.website}

STORY: ${b.brand.story}

TONE OF VOICE: ${b.voice.description}
Key qualities: ${b.voice.qualities.join(", ")}
Guidelines:
${b.voice.guidelines.map((g) => `- ${g}`).join("\n")}

SELLING POINTS:
${b.sellingPoints.map((s) => `- ${s}`).join("\n")}

PRODUCTS:
${b.products.map((p) => `- ${p.name} (${p.format}): ${p.protein} protein, ${p.calories} cal — "${p.keyBenefit}"`).join("\n")}

TARGET AUDIENCE:
${b.targetAudience.map((a) => `- ${a.segment}: ${a.traits.join(", ")}`).join("\n")}

MASCOT: ${b.mascot.name} — ${b.mascot.description}

IMPORTANT: ChiChi makes CHICKPEA hot cereal, NOT oatmeal. It's made from chickpeas, not oats. Always use "protein hot cereal" not "oatmeal."
`.trim();
}
