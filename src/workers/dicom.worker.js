import daikon from "daikon";
import { extractDicomMetadata } from "../utils/dicomMeta.js";

/**
 * Extract DICOM metadata, spatial parameters, and render grayscale pixels into RGBA buffer.
 */
export function parseDicomBuffer(buffer, isPatient = true) {
  const data = new DataView(buffer);
  const image = daikon.Series.parseImage(data);
  if (!image) return { ok: false };

  const rows = image.getRows ? image.getRows() : undefined;
  const cols = image.getCols ? image.getCols() : undefined;

  let meta = null;
  let detectedSeq = "T2";
  let detectedPlane = "Sag";

  if (isPatient) {
    meta = extractDicomMetadata(image);
    const desc = (meta.seriesDescription || "").toLowerCase();
    if (desc.includes("t2") || desc.includes("t 2")) detectedSeq = "T2";
    else if (desc.includes("t1") || desc.includes("t 1")) detectedSeq = "T1";
    else if (desc.includes("stir")) detectedSeq = "STIR";
    else if (desc.includes("pd")) {
      detectedSeq = (desc.includes("fs") || desc.includes("fat")) ? "PD Fat Sat" : "PD";
    }

    if (desc.includes("sag")) detectedPlane = "Sag";
    else if (desc.includes("cor")) detectedPlane = "Cor";
    else if (desc.includes("ax") || desc.includes("tra")) detectedPlane = "Ax";
    else {
      const oriTag = image.getTag(0x0020, 0x0037);
      if (oriTag && oriTag.value && oriTag.value.length === 6) {
        const [rx, ry, rz, cx, cy, cz] = oriTag.value;
        const nx = Math.abs(ry * cz - rz * cy);
        const ny = Math.abs(rz * cx - rx * cz);
        const nz = Math.abs(rx * cy - ry * cx);
        const max = Math.max(nx, ny, nz);
        if (max === nx) detectedPlane = "Sag";
        else if (max === ny) detectedPlane = "Cor";
        else if (max === nz) detectedPlane = "Ax";
      }
    }
  }

  let instanceNumber = null;
  const inTag = image.getTag(0x0020, 0x0013);
  if (inTag && inTag.value && inTag.value[0] !== undefined) {
    const parsed = parseInt(inTag.value[0], 10);
    if (!isNaN(parsed)) instanceNumber = parsed;
  }

  let sliceLocation = null;
  const slTag = image.getTag(0x0020, 0x1041);
  if (slTag && slTag.value && slTag.value[0] !== undefined) {
    const parsed = parseFloat(slTag.value[0]);
    if (!isNaN(parsed)) sliceLocation = parsed;
  }

  let imagePositionPatient = null;
  const ippTag = image.getTag(0x0020, 0x0032);
  if (ippTag && ippTag.value && ippTag.value.length >= 3) {
    imagePositionPatient = [
      parseFloat(ippTag.value[0]),
      parseFloat(ippTag.value[1]),
      parseFloat(ippTag.value[2])
    ];
  }

  let imageOrientationPatient = null;
  const iopTag = image.getTag(0x0020, 0x0037);
  if (iopTag && iopTag.value && iopTag.value.length >= 6) {
    imageOrientationPatient = [
      parseFloat(iopTag.value[0]),
      parseFloat(iopTag.value[1]),
      parseFloat(iopTag.value[2]),
      parseFloat(iopTag.value[3]),
      parseFloat(iopTag.value[4]),
      parseFloat(iopTag.value[5])
    ];
  }

  let ps = null;
  const psTag = image.getTag(0x0028, 0x0030);
  if (psTag && psTag.value) {
    if (Array.isArray(psTag.value) && psTag.value.length >= 2) {
      ps = [parseFloat(psTag.value[0]), parseFloat(psTag.value[1])];
    } else if (typeof psTag.value[0] === "string") {
      const parts = psTag.value[0].split("\\");
      if (parts.length >= 2) ps = [parseFloat(parts[0]), parseFloat(parts[1])];
    }
  }

  const rawData = image.getInterpretedData();
  let rgba = null;
  if (rawData && cols > 0 && rows > 0) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i] < min) min = rawData[i];
      if (rawData[i] > max) max = rawData[i];
    }

    let wc = image.getWindowCenter();
    let ww = image.getWindowWidth();
    if (Array.isArray(wc)) wc = wc[0];
    if (Array.isArray(ww)) ww = ww[0];

    if (!wc || !ww) {
      wc = (max + min) / 2;
      ww = (max - min) || 1;
    }

    const minP = wc - ww / 2;
    rgba = new Uint8ClampedArray(cols * rows * 4);
    for (let i = 0; i < rawData.length; i++) {
      let n = ((rawData[i] - minP) / ww) * 255;
      if (n < 0) n = 0;
      else if (n > 255) n = 255;
      const idx = i * 4;
      rgba[idx] = n;
      rgba[idx + 1] = n;
      rgba[idx + 2] = n;
      rgba[idx + 3] = 255;
    }
  }

  return {
    ok: true,
    rgba: rgba ? rgba.buffer : null,
    cols,
    rows,
    meta,
    detectedSeq,
    detectedPlane,
    ps,
    instanceNumber,
    sliceLocation,
    imagePositionPatient,
    imageOrientationPatient
  };
}

if (typeof self !== "undefined" && typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage = ({ data: { id, buffer, isPatient } }) => {
    try {
      const res = parseDicomBuffer(buffer, isPatient);
      if (res.ok && res.rgba) {
        self.postMessage({ id, ...res }, [res.rgba]);
      } else {
        self.postMessage({ id, ...res });
      }
    } catch (e) {
      self.postMessage({ id, ok: false, error: e?.message || String(e) });
    }
  };
}
