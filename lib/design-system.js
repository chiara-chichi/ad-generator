// Copy quality guidelines for Claude prompts.
// Now that Creatomate handles visual rendering, these focus on copywriting quality.

export const COPY_GUIDELINES = `
COPY QUALITY (follow these):
- Headlines: punchy, max 8 words. Lead with taste or experience, follow with nutrition.
- Subheadlines: supporting detail, max 15 words.
- Body copy: brief, max 25 words. Focus on one key benefit.
- CTAs: 2-4 words, action-oriented, high urgency.
- Never say "oatmeal" — say "protein hot cereal" or "chickpea cereal."
- Tone: warm, upbeat, approachable — like a trusted friend who's excited about breakfast.
- Use brand colors only when specifying color modifications.
`;

// Keep the old export name as an alias for backward compatibility
export const QUALITY_GUIDELINES = COPY_GUIDELINES;
