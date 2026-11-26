import daikon from "daikon";
import { extractDicomMetadata } from "../utils/dicomMeta.js";

/**
 * Fast 2nd-98th percentile histogram window estimation when DICOM WC/WW tags are absent.
 */
function computePercentileWindow(rawData, min, max) {
  const span = max - min;
  if (!(span > 0)) return { wc: min, ww: 1 };

  const bins = 256;
  const hist = new Uint32Array(bins);
  const scale = (bins - 1) / span;
  const len = rawData.length;

  for (let i = 0; i < len; i++) {
    let b = Math.floor((rawData[i] - min) * scale);
    if (b < 0) b = 0;
    else if (b >= bins) b = bins - 1;
    hist[b]++;
  }

  const lowTarget = Math.floor(len * 0.02);
  const highTarget = Math.ceil(len * 0.98);
  let acc = 0;
  let lowBin = 0;
  let highBin = bins - 1;

  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc >= lowTarget) {
      lowBin = b;
      break;
    }
  }

  acc = 0;
  for (let b = 0; b < bins; b++) {
    acc += hist[b];
    if (acc >= highTarget) {
      highBin = b;
      break;
    }
  }

  const lowVal = min + (lowBin / (bins - 1)) * span;
  const highVal = min + (highBin / (bins - 1)) * span;
  const ww = Math.max(1, highVal - lowVal);
  const wc = (lowVal + highVal) / 2;
  return { wc, ww };
}

/**
 * Extract DICOM metadata, spatial parameters, raw 16-bit pixels, and 8-bit preview RGBA.
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

  const piTag = image.getTag(0x0028, 0x0004);
  const piVal = piTag && piTag.value && piTag.value[0] ? String(piTag.value[0]).trim().toUpperCase() : "";
  const isMonochrome1 = piVal === "MONOCHROME1";

  const rawData = image.getInterpretedData();
  let rgba = null;
  let rawBuffer = null;
  let rawType = null;
  let wc = null;
  let ww = null;
  let minVal = null;
  let maxVal = null;

  if (rawData && cols > 0 && rows > 0) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < rawData.length; i++) {
      const v = rawData[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    minVal = min;
    maxVal = max;

    wc = image.getWindowCenter();
    ww = image.getWindowWidth();
    if (Array.isArray(wc)) wc = wc[0];
    if (Array.isArray(ww)) ww = ww[0];
    wc = typeof wc === "number" && !Number.isNaN(wc) ? wc : parseFloat(wc);
    ww = typeof ww === "number" && !Number.isNaN(ww) ? ww : parseFloat(ww);

    if (!Number.isFinite(wc) || !Number.isFinite(ww) || ww <= 0) {
      const est = computePercentileWindow(rawData, min, max);
      wc = est.wc;
      ww = est.ww;
    }
    if (!Number.isFinite(wc) || !Number.isFinite(ww) || ww <= 0) {
      wc = (max + min) / 2;
      ww = (max - min) || 1;
    }

    const useInt16 = min >= -32768 && max <= 32767;
    const rawTyped = useInt16 ? new Int16Array(rawData.length) : new Float32Array(rawData.length);
    rawType = useInt16 ? "int16" : "float32";

    const minP = wc - ww / 2;
    rgba = new Uint8ClampedArray(cols * rows * 4);
    for (let i = 0; i < rawData.length; i++) {
      const val = rawData[i];
      rawTyped[i] = val;
      let n = ((val - minP) / ww) * 255;
      if (n < 0) n = 0;
      else if (n > 255) n = 255;
      if (isMonochrome1) n = 255 - n;
      const idx = i * 4;
      rgba[idx] = n;
      rgba[idx + 1] = n;
      rgba[idx + 2] = n;
      rgba[idx + 3] = 255;
    }
    rawBuffer = rawTyped.buffer;
  }

  return {
    ok: true,
    rgba: rgba ? rgba.buffer : null,
    rawBuffer,
    rawType,
    wc,
    ww,
    minVal,
    maxVal,
    isMonochrome1,
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
      const transfers = [];
      if (res.ok && res.rgba) transfers.push(res.rgba);
      if (res.ok && res.rawBuffer) transfers.push(res.rawBuffer);
      self.postMessage({ id, ...res }, transfers);
    } catch (e) {
      self.postMessage({ id, ok: false, error: e?.message || String(e) });
    }
  };
}
