// Shared design quality guidelines — kept SHORT and focused.
// Overloading with rules makes output worse, not better.

export const QUALITY_GUIDELINES = `
DESIGN QUALITY (follow these):
- Fonts: "Decoy, serif" for headlines, "Questa Sans, sans-serif" for body
- Headlines: big and bold (48-72px at 1080px). Body: 14-18px. Never same size for different text levels.
- Use brand colors only. Background should have depth — gradient or layered, not flat.
- CTA must be high-contrast and prominent.
- Give text breathing room — generous padding. Don't cram.
- All text must have overflow:hidden. Keep headlines to 1-2 lines max.
- Use padding (not margin) inside colored containers.
`;

export const SELF_REVIEW_PROMPT = `
Now review the ad you just created. Be honest — score it 1-10 on:
1. Layout match (does it match the reference structure exactly?)
2. Visual quality (does it look professional, not like generic AI output?)
3. Readability (is text clear, properly sized, not cramped or overflowing?)

If ANY score is below 7, you MUST fix the HTML and return the improved version.
Common issues to fix: wrong grid structure, text too small, flat backgrounds, cramped spacing, layout doesn't match reference.

Return your final (possibly improved) result as the same JSON format.
`;

export const SELF_REVIEW_SCRATCH_PROMPT = `
Now review the ad you just created. Be honest — score it 1-10 on:
1. Visual impact (would this stop someone scrolling?)
2. Visual quality (does it look professional, not like generic AI output?)
3. Readability (is text clear, properly sized, not cramped or overflowing?)
4. Message clarity (is there ONE clear message with a strong CTA?)

If ANY score is below 7, you MUST fix the HTML and return the improved version.
Common issues to fix: text too small, flat backgrounds, cramped spacing, weak CTA, too many competing messages.

Return your final (possibly improved) result as the same JSON format.
`;
