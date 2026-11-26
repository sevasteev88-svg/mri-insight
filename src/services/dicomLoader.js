let workerInstance = null;
let workerFailed = false;
let nextReqId = 1;
const pendingRequests = new Map();
let sharedCanvas = null;

function getWorker() {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (!workerInstance) {
    try {
      workerInstance = new Worker(new URL("../workers/dicom.worker.js", import.meta.url), { type: "module" });
      workerInstance.onmessage = (e) => {
        const { id, ...payload } = e.data || {};
        const req = pendingRequests.get(id);
        if (!req) return;
        pendingRequests.delete(id);
        req.resolve(payload);
      };
      workerInstance.onerror = (err) => {
        console.warn("DICOM worker error, falling back to lazy main-thread parser:", err);
        workerFailed = true;
        for (const [id, req] of pendingRequests.entries()) {
          pendingRequests.delete(id);
          req.reject(err);
        }
        try { workerInstance.terminate(); } catch {}
        workerInstance = null;
      };
    } catch (err) {
      console.warn("DICOM worker creation failed, falling back to lazy main-thread parser:", err);
      workerFailed = true;
      return null;
    }
  }
  return workerInstance;
}

function rgbaBufferToJpegDataUrl(rgbaBuffer, cols, rows) {
  if (!rgbaBuffer || !cols || !rows) return null;
  if (!sharedCanvas) sharedCanvas = document.createElement("canvas");
  sharedCanvas.width = cols;
  sharedCanvas.height = rows;
  const ctx = sharedCanvas.getContext("2d");
  const imgData = new ImageData(new Uint8ClampedArray(rgbaBuffer), cols, rows);
  ctx.putImageData(imgData, 0, 0);
  return sharedCanvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Parse a DICOM File in a lazy-loaded Web Worker (with lazy dynamic-import fallback).
 * Returns { ok, dataUrl, meta, detectedSeq, detectedPlane, ps, instanceNumber, sliceLocation, imagePositionPatient, imageOrientationPatient, rows, cols }
 */
export async function parseDicomFileInWorker(file, isPatient = true) {
  const buffer = await file.arrayBuffer();
  const worker = getWorker();

  if (worker) {
    try {
      const res = await new Promise((resolve, reject) => {
        const id = nextReqId++;
        pendingRequests.set(id, { resolve, reject });
        worker.postMessage({ id, buffer, isPatient }, [buffer]);
      });

      if (!res?.ok) return { ok: false };
      const dataUrl = rgbaBufferToJpegDataUrl(res.rgba, res.cols, res.rows);
      return { ...res, dataUrl };
    } catch {
      // Fall through to lazy main-thread fallback with a fresh buffer
    }
  }

  // Fallback: dynamic import keeps daikon out of the initial bundle
  const fallbackBuffer = buffer.byteLength > 0 ? buffer : await file.arrayBuffer();
  const { parseDicomBuffer } = await import("../workers/dicom.worker.js");
  const res = parseDicomBuffer(fallbackBuffer, isPatient);
  if (!res?.ok) return { ok: false };
  const dataUrl = rgbaBufferToJpegDataUrl(res.rgba, res.cols, res.rows);
  return { ...res, dataUrl };
}
