/**
 * Client-side image processing utilities.
 * Handles HEIC conversion, compression, and large file processing.
 */

/**
 * Convert HEIC/HEIF files to JPEG. Returns the original file if not HEIC.
 */
export async function convertHeicIfNeeded(file) {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (!isHeic) return file;

  // Dynamic import so heic2any only loads when needed
  const heic2any = (await import("heic2any")).default;
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  // heic2any can return an array for multi-image HEIC files
  const resultBlob = Array.isArray(blob) ? blob[0] : blob;
  return new File(
    [resultBlob],
    file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
    { type: "image/jpeg" }
  );
}

/**
 * Compress an image to fit within maxBytes.
 * - Scales down large images to maxDim
 * - Tries PNG first (transparency), falls back to JPEG
 * - For very large files, uses progressive quality reduction
 */
export async function compressImage(file, maxBytes = 3 * 1024 * 1024, maxDim = 2048) {
  // Skip SVGs and already-small files
  if (file.type === "image/svg+xml" || file.size <= maxBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if dimensions are huge
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Try PNG first
        canvas.toBlob(
          (pngBlob) => {
            if (pngBlob && pngBlob.size <= maxBytes) {
              resolve(
                new File([pngBlob], file.name.replace(/\.\w+$/, ".png"), {
                  type: "image/png",
                })
              );
            } else {
              // Compress as JPEG with progressively lower quality
              const tryJpeg = (quality) => {
                canvas.toBlob(
                  (jpegBlob) => {
                    if (!jpegBlob) {
                      reject(new Error("Image compression failed"));
                      return;
                    }
                    if (jpegBlob.size <= maxBytes || quality <= 0.5) {
                      resolve(
                        new File(
                          [jpegBlob],
                          file.name.replace(/\.\w+$/, ".jpg"),
                          { type: "image/jpeg" }
                        )
                      );
                    } else {
                      // Try lower quality
                      tryJpeg(quality - 0.1);
                    }
                  },
                  "image/jpeg",
                  quality
                );
              };
              tryJpeg(0.85);
            }
          },
          "image/png",
          1
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Full pipeline: convert HEIC if needed, then compress.
 */
export async function processImage(file, maxBytes = 3 * 1024 * 1024, maxDim = 2048) {
  const converted = await convertHeicIfNeeded(file);
  return compressImage(converted, maxBytes, maxDim);
}
