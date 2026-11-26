import { supabase } from "./supabase.js";

export const STORAGE_BUCKET = "mri-media";

export function getMediaSrc(item) {
  return item?.data || item?.url || "";
}

function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;
  const header = dataUrl.slice(0, commaIdx);
  const b64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64/i);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}

function sanitizeExt(mime, fileName) {
  if (fileName && fileName.includes(".")) {
    const ext = fileName.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (ext) return ext;
  }
  if (mime?.includes("pdf")) return "pdf";
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Resolves a cloud-stored attachment back into a base64 data URL when needed for Gemini OCR/review.
 */
export async function ensureAttachmentDataUrl(att) {
  if (!att) return null;
  if (att.data && typeof att.data === "string" && att.data.startsWith("data:")) {
    return att.data;
  }
  if (att.url) {
    try {
      const resp = await fetch(att.url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Failed to fetch Storage attachment:", e);
    }
  }
  return null;
}

/**
 * Uploads one base64 media item to Supabase Storage bucket `mri-media`.
 * Never throws; returns { ok: false } so callers can gracefully fall back to inline JSON.
 */
export async function uploadMediaToStorage(studyId, folder, itemId, dataUrl, fileName = "") {
  if (!studyId || !dataUrl || !dataUrl.startsWith("data:")) {
    return { ok: false, error: "Invalid media payload" };
  }

  try {
    const parsed = dataUrlToBlob(dataUrl);
    if (!parsed) return { ok: false, error: "Cannot decode base64 dataUrl" };

    const ext = sanitizeExt(parsed.mime, fileName);
    const safeId = String(itemId || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "");
    const storagePath = `${studyId}/${folder}/${safeId}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, parsed.blob, {
        contentType: parsed.mime,
        upsert: true
      });

    if (error) {
      return { ok: false, error: error.message || String(error) };
    }

    const { data: pubData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const url = pubData?.publicUrl || "";
    if (!url) return { ok: false, error: "Public URL unavailable" };

    return { ok: true, storagePath, url };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Syncs an array of keyImages or attachments to Supabase Storage.
 * - `localItems` keep `data` (fast offline viewing + keeps url/storagePath)
 * - `cloudItems` strip `data` ONLY for items successfully uploaded to Storage, preventing bloated DB JSON.
 */
export async function syncMediaListToStorage(studyId, folder, items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { cloudItems: [], localItems: [], uploadedCount: 0, fallbackUsed: false };
  }

  const localItems = [];
  const cloudItems = [];
  let uploadedCount = 0;
  let fallbackUsed = false;

  for (const item of items) {
    if (!item) continue;

    if (item.url) {
      localItems.push(item);
      const { data: _omit, ...cloudVersion } = item;
      cloudItems.push(cloudVersion);
      continue;
    }

    if (item.data && typeof item.data === "string" && item.data.startsWith("data:")) {
      const res = await uploadMediaToStorage(studyId, folder, item.id, item.data, item.name);
      if (res.ok) {
        uploadedCount++;
        const updatedLocal = { ...item, url: res.url, storagePath: res.storagePath };
        localItems.push(updatedLocal);
        const { data: _omit, ...cloudVersion } = updatedLocal;
        cloudItems.push(cloudVersion);
        continue;
      }
      fallbackUsed = true;
    }

    localItems.push(item);
    cloudItems.push(item);
  }

  return { cloudItems, localItems, uploadedCount, fallbackUsed };
}
