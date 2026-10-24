import "server-only";
import sharp, { type Metadata } from "sharp";

/** A problem with the uploaded file itself; the message is safe to show. */
export class PhotoError extends Error {}

const FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_EDGE = 1600;
/** Guards against decompression bombs (a tiny file that decodes to a huge bitmap). */
const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Validates an upload by its decoded contents (not the declared MIME type), applies the
 * EXIF orientation, then re-encodes it as WebP. Re-encoding drops all metadata, including
 * EXIF GPS coordinates, camera serials and embedded thumbnails.
 */
export async function processPhoto(input: Buffer) {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  let meta: Metadata;
  try {
    meta = await image.metadata();
  } catch {
    throw new PhotoError("We couldn't read that file. Use a JPG, PNG or WebP photo.");
  }
  if (!meta.format || !FORMATS.has(meta.format)) throw new PhotoError("Use a JPG, PNG or WebP photo.");
  if ((meta.pages ?? 1) > 1) throw new PhotoError("Animated images aren't supported.");

  try {
    const { data, info } = await image
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new PhotoError("We couldn't process that photo. Try a different one.");
  }
}
