import { CAPTURE_RELATED } from '../constants/anatomy';
import { UA_TO_EN } from '../constants/dictionaries';

// Collect materials (refs/atlas/kb) for a zone plus its related detailed structures
export function collectZoneMaterials(store, zoneKey) {
  const out = [...(store[zoneKey] || [])];
  const related = CAPTURE_RELATED[zoneKey] || [];
  related.forEach(k => { if (store[k]) out.push(...store[k]); });
  return out;
}

export function anonymizeImage(dataUrl, crop = 12) {
  return new Promise(res => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      res(dataUrl);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const w = img.width - crop * 2, h = img.height - crop * 2;
        if (w <= 0 || h <= 0) { res(dataUrl); return; }
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, crop, crop, w, h, 0, 0, w, h);
        // Black out only TOP corners where patient name/DOB usually appears
        ctx.fillStyle = "#000";
        const bw = Math.min(180, w * 0.28);
        ctx.fillRect(0, 0, bw, 24);
        ctx.fillRect(w - bw, 0, bw, 24);
        res(c.toDataURL("image/jpeg", 0.95));
      } catch (e) {
        res(dataUrl);
      }
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

export function radioUrl(term) {
  const t = term.trim().toLowerCase();
  if (UA_TO_EN[t]) return `https://radiopaedia.org/search?q=${encodeURIComponent(UA_TO_EN[t])}&scope=all`;
  for (const [k, v] of Object.entries(UA_TO_EN)) {
    if (t.includes(k) || k.includes(t)) return `https://radiopaedia.org/search?q=${encodeURIComponent(v)}&scope=all`;
  }
  return `https://radiopaedia.org/search?q=${encodeURIComponent(term.trim())}&scope=all`;
}

export function translateTerm(term) {
  if (!term || !term.trim()) return null;
  const t = term.trim().toLowerCase();
  if (UA_TO_EN[t]) return UA_TO_EN[t];
  for (const [k, v] of Object.entries(UA_TO_EN)) {
    if (t.includes(k) || k.includes(t)) return v;
  }
  return null;
}

export const confColor = (l) => {
  if (l >= 85) return { c: "#22c55e", bg: "rgba(34,197,94,.12)" };
  if (l >= 60) return { c: "#eab308", bg: "rgba(234,179,8,.12)" };
  return { c: "#ef4444", bg: "rgba(239,68,68,.12)" };
};

export function compressImage(dataUrl, maxDimension = 1600, quality = 0.8) {
  return new Promise(res => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      res(dataUrl);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      try {
        let w = img.width;
        let h = img.height;
        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", quality));
      } catch (e) {
        res(dataUrl);
      }
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

