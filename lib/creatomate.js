import { Client } from "creatomate";

const apiKey = process.env.CREATOMATE_API_KEY;

export const creatomateClient = apiKey ? new Client(apiKey) : null;

/**
 * Render a single Creatomate template with modifications.
 * Awaits completion and returns the render array.
 */
export async function renderTemplate(templateId, modifications = {}, options = {}) {
  if (!creatomateClient) {
    throw new Error("Creatomate not configured — set CREATOMATE_API_KEY");
  }

  const renders = await creatomateClient.render({
    templateId,
    modifications,
    outputFormat: options.outputFormat || "png",
    ...(options.renderScale && { renderScale: options.renderScale }),
    ...(options.maxWidth && { maxWidth: options.maxWidth }),
    ...(options.maxHeight && { maxHeight: options.maxHeight }),
  });

  return renders;
}

/**
 * Render all templates matching the given tags (multi-size).
 * Returns an array of renders — one per matching template.
 */
export async function renderByTag(tags, modifications = {}, options = {}) {
  if (!creatomateClient) {
    throw new Error("Creatomate not configured — set CREATOMATE_API_KEY");
  }

  const renders = await creatomateClient.render({
    tags,
    modifications,
    outputFormat: options.outputFormat || "png",
    ...(options.renderScale && { renderScale: options.renderScale }),
  });

  return renders;
}
