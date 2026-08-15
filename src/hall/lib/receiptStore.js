// ─────────────────────────────────────────────────────────────────────────────
// Invoice photos for the coffee house.
//
// Why this is not just another field on the row: all the Restaurant records live
// in ONE document in app_config. A photo straight off a phone is 3–4 MB, which
// becomes ~5 MB once encoded, so thirty receipts would push that single document
// past 100 MB. It would sync slowly, then fail to save at all — and take the
// books down with it, because the sales and the receipts share a row.
//
// So each photo is:
//   1. shrunk in the browser before it is stored (long edge 1200px, JPEG 0.72 —
//      about 150 KB, still easily readable), and
//   2. kept as its OWN record, fetched only when someone taps it.
//
// The books document holds nothing but the id and the file name.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = id => "hall_receipt_" + id;
const MAX_EDGE = 1200;
const QUALITY = 0.72;
/** Anything bigger than this after shrinking is refused rather than silently
 *  breaking the sync later. ~1.5 MB of base64. */
export const MAX_STORED_BYTES = 1_500_000;

export const newReceiptId = () =>
  "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/**
 * Shrink an image file to a data URL. Non-images (a PDF, say) are returned
 * untouched — there is nothing sensible to resize.
 */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("no file"));
    const readAsIs = () => {
      const r = new FileReader();
      r.onload = e => resolve(String(e.target.result));
      r.onerror = () => reject(new Error("could not read the file"));
      r.readAsDataURL(file);
    };
    if (!/^image\//.test(file.type)) return readAsIs();

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          // White behind, so a transparent PNG does not turn black as a JPEG.
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", QUALITY));
        } catch { readAsIs(); }
      };
      img.onerror = () => readAsIs();
      img.src = String(e.target.result);
    };
    reader.onerror = () => reject(new Error("could not read the file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Store one receipt. localStorage always (so it shows instantly and offline),
 * app_config too when Supabase is configured, so other devices can see it.
 */
export async function saveReceipt(id, dataUrl, name) {
  const payload = { data: dataUrl, name: name || "", at: new Date().toISOString() };
  try { localStorage.setItem(KEY(id), JSON.stringify(payload)); } catch { /* full — the cloud copy still stands */ }
  try {
    const { hasSupabase } = await import("../../utils/supabaseSync");
    if (!hasSupabase()) return;
    const { saveConfig } = await import("../../utils/supabaseSync");
    await saveConfig(KEY(id), payload);
  } catch { /* offline: the local copy is kept and re-sent next time it is saved */ }
}

/** Fetch one receipt. Local cache first, then the cloud. */
export async function loadReceipt(id) {
  if (!id) return null;
  try {
    const cached = localStorage.getItem(KEY(id));
    if (cached) return JSON.parse(cached);
  } catch { /* fall through to the cloud */ }
  try {
    const { loadConfig } = await import("../../utils/supabaseSync");
    const v = await loadConfig(KEY(id));
    if (v && v.data) {
      try { localStorage.setItem(KEY(id), JSON.stringify(v)); } catch { /* cache is optional */ }
      return v;
    }
  } catch { /* offline */ }
  return null;
}

/** Drop the local copy. The cloud record is left alone — a deleted row can be
 *  restored from another device, and a stray receipt costs nothing. */
export function forgetReceiptLocally(id) {
  if (!id) return;
  try { localStorage.removeItem(KEY(id)); } catch { /* nothing to do */ }
}
