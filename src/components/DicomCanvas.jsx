import React, { useEffect, useRef } from "react";

export const WL_PRESETS = [
  { id: "auto", label: "DICOM Авто", wcFactor: 1.0, wwFactor: 1.0 },
  { id: "soft", label: "М'які тканини", wcFactor: 1.0, wwFactor: 0.85 },
  { id: "bone", label: "Кістки / Набряк", wcFactor: 1.15, wwFactor: 1.45 },
  { id: "cartilage", label: "Хрящ / Меніск", wcFactor: 0.85, wwFactor: 0.55 },
  { id: "fluid", label: "Рідина / STIR", wcFactor: 1.3, wwFactor: 0.75 }
];

export function computePresetWl(slice, presetId) {
  if (!slice || slice.wc == null || slice.ww == null) return null;
  const preset = WL_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.id === "auto") {
    return { wc: null, ww: null };
  }
  const baseWc = Number(slice.wc) || 0;
  const baseWw = Math.max(1, Number(slice.ww) || 1);
  return {
    wc: baseWc * preset.wcFactor,
    ww: Math.max(1, baseWw * preset.wwFactor)
  };
}

/**
 * Renders 16-bit DICOM rawPixels onto Canvas with real-time WC/WW + invert,
 * or falls back cleanly to <img> with CSS filters for JPEG/PNG or cloud-only studies.
 */
export default function DicomCanvas({ slice, wl, style = {}, showHud = true }) {
  const canvasRef = useRef(null);
  const imgDataRef = useRef(null);

  const hasRaw = Boolean(slice?.rawPixels && slice.cols > 0 && slice.rows > 0);
  const effectiveWc = wl?.wc ?? slice?.wc ?? 0;
  const effectiveWw = Math.max(1, wl?.ww ?? slice?.ww ?? 1);
  const invert = Boolean(slice?.isMonochrome1) !== Boolean(wl?.invert);

  useEffect(() => {
    if (!hasRaw || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const cols = slice.cols;
    const rows = slice.rows;
    if (canvas.width !== cols) canvas.width = cols;
    if (canvas.height !== rows) canvas.height = rows;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!imgDataRef.current || imgDataRef.current.width !== cols || imgDataRef.current.height !== rows) {
      imgDataRef.current = ctx.createImageData(cols, rows);
    }

    const imgData = imgDataRef.current;
    const dst = imgData.data;
    const raw = slice.rawPixels;
    const minP = effectiveWc - effectiveWw / 2;
    const invWw255 = 255 / effectiveWw;
    const len = Math.min(raw.length, cols * rows);

    for (let i = 0; i < len; i++) {
      let n = (raw[i] - minP) * invWw255;
      if (n < 0) n = 0;
      else if (n > 255) n = 255;
      if (invert) n = 255 - n;
      const idx = i * 4;
      dst[idx] = n;
      dst[idx + 1] = n;
      dst[idx + 2] = n;
      dst[idx + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
  }, [hasRaw, slice, effectiveWc, effectiveWw, invert]);

  if (!slice) return null;

  if (hasRaw) {
    return (
      <>
        <canvas
          ref={canvasRef}
          width={slice.cols}
          height={slice.rows}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: 4,
            pointerEvents: "none",
            ...style
          }}
        />
        {showHud && (
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              background: "rgba(6,8,12,0.72)",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 9,
              color: "#94a3b8",
              fontFamily: "'JetBrains Mono',monospace",
              pointerEvents: "none",
              zIndex: 12
            }}
          >
            WC:{Math.round(effectiveWc)} WW:{Math.round(effectiveWw)} · 16-bit
          </div>
        )}
      </>
    );
  }

  return (
    <img
      src={slice.data || slice.url || ""}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        borderRadius: 4,
        pointerEvents: "none",
        filter: `brightness(${wl?.b ?? 100}%) contrast(${wl?.c ?? 100}%)${wl?.invert ? " invert(1)" : ""}`,
        ...style
      }}
    />
  );
}
