// Owner photos: limits and a small JPEG reader that checks the file and removes hidden camera data (location, device, comments).
export const MAX_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 1_000_000;

export interface Photo { id: number; business_id: number; key: string; width: number | null; height: number | null; caption: string | null; status: string; created_at: string; bytes: number }

/** Returns the cleaned image and its size in pixels, or null when the file is not a readable JPEG. */
export function cleanJpeg(buf: Uint8Array): { data: Uint8Array; width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [buf.subarray(0, 2)];
  let width = 0, height = 0, i = 2, done = false;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xda) { parts.push(buf.subarray(i)); done = true; break; } // image data runs to the end of the file
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (len < 2 || i + 2 + len > buf.length) return null;
    const isSize = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (isSize && len >= 7) { height = (buf[i + 5] << 8) | buf[i + 6]; width = (buf[i + 7] << 8) | buf[i + 8]; }
    // Keep what a browser needs to draw the picture; drop EXIF/XMP (0xe1), other app notes and comments.
    const keep = !(m === 0xe1 || (m >= 0xe3 && m <= 0xed) || m === 0xef || m === 0xfe);
    if (keep) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (!done || !width || !height) return null;
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return { data: out, width, height };
}

export async function livePhotos(db: D1Database, businessId: number) {
  const { results } = await db.prepare(`SELECT id, business_id, key, width, height, caption, status, created_at, bytes FROM photos WHERE business_id = ? AND status = 'live' ORDER BY id LIMIT ${MAX_PHOTOS}`)
    .bind(businessId).all<Photo>();
  return results;
}
