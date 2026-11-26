/**
 * Builds numbered 4x4 (or configurable) JPEG contact sheets from an array of MRI slice objects
 * for fast Stage-1 triage before high-resolution Stage-2 analysis.
 */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode slice image for contact sheet"));
    img.src = src;
  });
}

export async function buildContactSheets(slices, options = {}) {
  const {
    cols = 4,
    rows = 4,
    tileSize = 256,
    indexOffset = 0,
    labelPrefix = "#"
  } = options;

  if (!Array.isArray(slices) || slices.length === 0) return [];

  const perPage = Math.max(1, cols * rows);
  const sheets = [];

  for (let start = 0; start < slices.length; start += perPage) {
    const pageSlices = slices.slice(start, start + perPage);
    const canvas = document.createElement("canvas");
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < pageSlices.length; i++) {
      const slice = pageSlices[i];
      if (!slice?.data) continue;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = col * tileSize;
      const cellY = row * tileSize;

      try {
        const img = await loadImage(slice.data);
        const scale = Math.min(tileSize / (img.width || tileSize), tileSize / (img.height || tileSize));
        const drawW = Math.round((img.width || tileSize) * scale);
        const drawH = Math.round((img.height || tileSize) * scale);
        const drawX = cellX + Math.floor((tileSize - drawW) / 2);
        const drawY = cellY + Math.floor((tileSize - drawH) / 2);
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      } catch {
        // Leave cell black if image fails to load
      }

      // Subtle cell border
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX + 0.5, cellY + 0.5, tileSize - 1, tileSize - 1);

      // Slice number badge
      const sliceNumber = typeof slice._originalIndex === "number"
        ? slice._originalIndex
        : indexOffset + start + i;
      const label = `${labelPrefix}${sliceNumber}`;
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      const textW = ctx.measureText(label).width;
      const padX = 7;
      const boxW = Math.ceil(textW + padX * 2);
      const boxH = 24;

      ctx.fillStyle = "rgba(6, 8, 12, 0.85)";
      ctx.beginPath();
      ctx.roundRect(cellX + 6, cellY + 6, boxW, boxH, 5);
      ctx.fill();

      ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cellX + 6 + padX, cellY + 6 + boxH / 2 + 1);
    }

    const endIdx = start + pageSlices.length - 1;
    sheets.push({
      dataUrl: canvas.toDataURL("image/jpeg", 0.78),
      startIdx: start,
      endIdx,
      count: pageSlices.length
    });
  }

  return sheets;
}
