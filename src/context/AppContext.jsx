import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase.js";
import { openDB, dbGet, dbPut, dbGetAll } from "../services/db.js";
import { parseDicomFileInWorker } from "../services/dicomLoader.js";
import { ZONES, parseSeriesKey, formatSeriesLabel } from "../constants/anatomy.js";
import { SYS_PROMPT, getPromptRoi, getPromptManual } from "../constants/prompts.js";
import { anonymizeImage, collectZoneMaterials, confColor, compressImage } from "../utils/helpers.js";
import { STRUCTURED_KB, INITIAL_KB } from "../constants/anatomy_kb.js";
import {
  DEFAULT_MODEL,
  normalizeModelId,
  analyzeStudy,
  analyzeRoiRegion,
  askAnatomyQuestion,
  extractConclusionOcr,
  reviewCenterConclusion,
  generateMedicalProtocol,
  transcribeMedicalAudio
} from "../services/gemini.js";
import { openPrintableReport } from "../utils/reportExport.js";
import { syncMediaListToStorage, ensureAttachmentDataUrl } from "../services/storage.js";

const isUuid = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [cloudSyncStatus, setCloudSyncStatus] = useState("online");
  const [isLocked, setIsLocked] = useState(true);
  const [scr, setScr] = useState("dash");
  const [apiKey, setApiKey] = useState("");
  const [archiveHandle, setArchiveHandle] = useState(null);
  const [archiveStatus, setArchiveStatus] = useState("none"); // none, prompt, ready
  const [archivePatients, setArchivePatients] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [apiKeyIn, setApiKeyIn] = useState("");
  const [aiModel, setAiModel] = useState(DEFAULT_MODEL);
  const [refs, setRefs] = useState({});
  const [atlas, setAtlas] = useState({}); // {zone: [{id, name, data, label}]}
  const [kb, setKb] = useState({}); // {zone: [{id, title, text}]}
  const [libTab, setLibTab] = useState("refs"); // "refs" | "atlas" | "kb"
  const [selZone, setSelZone] = useState("knee");
  const [expandedSubs, setExpandedSubs] = useState({}); // {subKey: bool} for collapsible muscle/ligament submenus
  const [studies, setStudies] = useState([]);
  const [study, setStudy] = useState(null);
  const [prog, setProg] = useState(null);
  const [viewImg, setViewImg] = useState(null);
  const [showSet, setShowSet] = useState(false);
  const [anon, setAnon] = useState(true);
  const [splitIdx, setSplitIdx] = useState(0);
  const [refIdx, setRefIdx] = useState(0);
  const [showRefP, setShowRefP] = useState(false);
  const [prevScr, setPrevScr] = useState("new");
  const [vnotes, setVnotes] = useState({});
  const [recording, setRecording] = useState(null);
  const [transcribing, setTranscribing] = useState(null);
  const [pdfM, setPdfM] = useState(null);
  const [pdfOk, setPdfOk] = useState(false);
  const [toast, setToast] = useState(null);
  const [rf, setRf] = useState(""); const [rt, setRt] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [conclusionReview, setConclusionReview] = useState(null); // AI review of center's conclusion
  const [reviewLoading, setReviewLoading] = useState(false);
  const [roi, setRoi] = useState(null); // {x,y,w,h} normalized 0-1
  const [roiDrawing, setRoiDrawing] = useState(false);
  const [roiStart, setRoiStart] = useState(null);
  const [roiResult, setRoiResult] = useState(null);
  const [roiLoading, setRoiLoading] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  // Viewer zoom/pan state — separate for patient (L) and reference (R) panels
  const [zoomL, setZoomL] = useState({ scale: 1, x: 0, y: 0 });
  const [wlL, setWlL] = useState({ b: 100, c: 100, wc: null, ww: null, invert: false, preset: "auto" });
  const [wlR, setWlR] = useState({ b: 100, c: 100, wc: null, ww: null, invert: false, preset: "auto" });
  const [windowing, setWindowing] = useState(null);
  const [rightMode, setRightMode] = useState("ref");
  const [compareSeriesKey, setCompareSeriesKey] = useState(null);
  const [compareIdx, setCompareIdx] = useState(0);
  const [syncScroll, setSyncScroll] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [aiMarkers, setAiMarkers] = useState({});
  const [aiScanning, setAiScanning] = useState(false);
  const [toolMode, setToolMode] = useState("roi");
  const [measurementsBySlice, setMeasurementsBySlice] = useState({});
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = ({ title, message, confirmLabel = "Підтвердити", danger = false, onConfirm }) => {
    setConfirmDialog({ title, message, confirmLabel, danger, onConfirm });
  };
  const [activeMeasure, setActiveMeasure] = useState(null);
  const [activeArea, setActiveArea] = useState(null);
  const [activeAngle, setActiveAngle] = useState([]);
  const [angleMousePos, setAngleMousePos] = useState(null);
  const [zoomR, setZoomR] = useState({ scale: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(null); // {side, startX, startY, origX, origY}
  const [refSource, setRefSource] = useState("refs"); // "refs" | "atlas" | "kb"

  const refIn = useRef(null), pdfIn = useRef(null), patIn = useRef(null), folderIn = useRef(null), recRef = useRef(null), mediaRecRef = useRef(null), audioChunksRef = useRef([]), attachIn = useRef(null), atlasIn = useRef(null);
  const roiImgRef = useRef(null);

  // Clipboard paste handler for library
  useEffect(() => {
    const handler = (e) => {
      if (scr !== "lib") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (libTab === "atlas") {
              const label = prompt("Опис зображення:\nНаприклад: 'ПКС на сагітальному зрізі' або 'Медіальний меніск'");
              if (label && label.trim()) {
                setAtlas(p => ({ ...p, [selZone]: [...(p[selZone] || []), { id: Date.now() + Math.random(), name: "Вставлено з буфера", data: ev.target.result, label: label.trim(), ts: Date.now() }] }));
                flash("Зображення додано до атласу");
              }
            } else {
              const obj = { id: Date.now() + Math.random(), name: "Вставлено з буфера", data: ev.target.result, ts: Date.now(), src: "clipboard" };
              setRefs(p => ({ ...p, [selZone]: [...(p[selZone] || []), obj] }));
              flash("Зображення вставлено з буфера обміну");
            }
          };
          reader.readAsDataURL(blob);
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [scr, selZone, libTab]);




  const [syncingCloud, setSyncingCloud] = useState(false);

  const fetchCloudStudies = useCallback(async () => {
    try {
      setSyncingCloud(true);
      const { data, error } = await supabase
        .from("studies")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.warn("Supabase fetch error:", error);
        setCloudSyncStatus("offline");
        return;
      }

      setCloudSyncStatus("online");
      if (Array.isArray(data) && data.length > 0) {
        // Map supabase rows to local overview meta format
        const cloudMetaList = data.map(row => ({
          id: row.id,
          pn: row.patient_name,
          z: row.zone,
          d: row.study_date,
          mriDate: row.mri_date || row.study_date,
          ic: row.total_images || 0,
          fc: (row.findings || []).length,
          archived: row.archived || false,
          hasNotes: Boolean(row.doctor_notes && Object.keys(row.doctor_notes).length > 0)
        }));

        setStudies(prev => {
          // Merge local and cloud studies, preferring cloud row if id matches
          const localMap = new Map((prev || []).map(s => [String(s.id), s]));
          cloudMetaList.forEach(c => localMap.set(String(c.id), c));
          const merged = Array.from(localMap.values());
          try { localStorage.setItem("mri-hist", JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
    } catch (e) {
      console.warn("Cloud sync exception:", e);
      setCloudSyncStatus("offline");
    } finally {
      setSyncingCloud(false);
    }
  }, []);

  useEffect(() => {
    if (!window.pdfjsLib) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; setPdfOk(true); };
      document.head.appendChild(s);
    } else setPdfOk(true);
    (async () => {
      try { const r = localStorage.getItem("mri-key"); if (r) { setApiKey(r); setApiKeyIn(r); } } catch {}
      try {
        const r = localStorage.getItem("mri-model");
        if (r) {
          const normalized = normalizeModelId(r);
          setAiModel(normalized);
          if (normalized !== r) localStorage.setItem("mri-model", normalized);
        }
      } catch {}
      try { const r = localStorage.getItem("mri-hist"); if (r) setStudies(JSON.parse(r)); } catch {}
      // Load refs, atlas, kb from IndexedDB
      try {
        const allRefs = await dbGetAll("refs");
        const r = {}, a = {}, k = {};
        Object.entries(allRefs).forEach(([key, v]) => {
          if (key.startsWith("atlas_")) a[key.replace("atlas_", "")] = v;
          else if (key.startsWith("kb_")) k[key.replace("kb_", "")] = v;
          else r[key] = v;
        });
        if (Object.keys(r).length > 0) setRefs(r);
        if (Object.keys(a).length > 0) setAtlas(a);
        const mergedKb = { ...INITIAL_KB };
        Object.entries(k).forEach(([zone, entries]) => {
          if (!mergedKb[zone]) mergedKb[zone] = [];
          entries.forEach(e => { if (!mergedKb[zone].find(x => x.id === e.id)) mergedKb[zone].push(e); });
        });
        setKb(mergedKb);
      } catch {}

      // Restore persisted local PACS archive directory handle
      try {
        const savedHandle = await dbGet("archive", "root_handle");
        if (savedHandle) {
          setArchiveHandle(savedHandle);
          const perm = savedHandle.queryPermission ? await savedHandle.queryPermission({ mode: "read" }) : "prompt";
          if (perm === "granted") {
            setArchiveStatus("ready");
            loadArchive(savedHandle);
          } else {
            setArchiveStatus("prompt");
          }
        }
      } catch {}

      // Fetch fresh studies from Cloud Supabase
      await fetchCloudStudies();
    })();
  }, [fetchCloudStudies]);

  // Prevent browser zoom on Ctrl+Wheel globally
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Save refs + atlas + kb to IndexedDB whenever they change
  const refsInitialized = useRef(false);
  useEffect(() => {
    if (!refsInitialized.current) { refsInitialized.current = true; return; }
    const saveAll = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction("refs", "readwrite");
        const store = tx.objectStore("refs");
        store.clear();
        Object.entries(refs).forEach(([zone, imgs]) => { if (imgs.length > 0) store.put(imgs, zone); });
        Object.entries(atlas).forEach(([zone, imgs]) => { if (imgs.length > 0) store.put(imgs, `atlas_${zone}`); });
        Object.entries(kb).forEach(([zone, entries]) => { if (entries.length > 0) store.put(entries, `kb_${zone}`); });
      } catch (e) { console.error("Failed to save:", e); }
    };
    saveAll();
  }, [refs, atlas, kb]);

  const flash = m => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const saveKey = async () => {
    setApiKey(apiKeyIn);
    try { localStorage.setItem("mri-key", apiKeyIn); } catch {}
    setShowSet(false); flash("API ключ збережено");
  };

  const uploadImgs = async (files, target, initialStudy = null) => {
    try {
      // Filter files: exclude known non-image files like DICOMDIR, desktop.ini, DS_Store
      const list = Array.from(files).filter(f => {
        const nm = f.name.toUpperCase();
        if (nm === "DICOMDIR" || nm === "DESKTOP.INI" || nm === ".DS_STORE" || nm.endsWith(".TXT") || nm.endsWith(".PDF")) return false;
        return true;
      });

      if (list.length === 0) return;
      setUploadProgress({ done: 0, total: list.length });
      
      let baseStudy = initialStudy || study;
      let accumulatedSeries = { ...(baseStudy?.series || {}) };
      let extractedMeta = null;
      const detectedZonesSet = new Set();
      if (baseStudy?.zones && Array.isArray(baseStudy.zones)) {
        baseStudy.zones.forEach(z => detectedZonesSet.add(z));
      } else if (baseStudy?.zone) {
        detectedZonesSet.add(baseStudy.zone);
      }

      let processedCount = 0;
      let fileIdx = 0;

      for (const f of list) {
        fileIdx++;
        setUploadProgress({ done: fileIdx, total: list.length });
        let d = null;
        let detectedSeq = "T2";
        let detectedPlane = "Sag";
        let sliceZone = null;
        let ps = null;
        let instanceNumber = null;
        let sliceLocation = null;
        let imagePositionPatient = null;
        let imageOrientationPatient = null;
        let sliceRows = undefined;
        let sliceCols = undefined;
        let sliceRawPixels = null;
        let sliceWc = null;
        let sliceWw = null;
        let sliceMinVal = null;
        let sliceMaxVal = null;
        let sliceIsMono1 = false;

        // Attempt DICOM parsing in Web Worker for all files unless explicitly standard web images
        const isStandardWebImage = f.type.startsWith("image/png") || f.type.startsWith("image/jpeg") || f.type.startsWith("image/webp");

        if (!isStandardWebImage) {
          try {
            const parsed = await parseDicomFileInWorker(f, target === "patient");
            if (parsed?.ok) {
              sliceRows = parsed.rows;
              sliceCols = parsed.cols;
              sliceRawPixels = parsed.rawPixels || null;
              sliceWc = parsed.wc ?? null;
              sliceWw = parsed.ww ?? null;
              sliceMinVal = parsed.minVal ?? null;
              sliceMaxVal = parsed.maxVal ?? null;
              sliceIsMono1 = Boolean(parsed.isMonochrome1);
              ps = parsed.ps;
              instanceNumber = parsed.instanceNumber;
              sliceLocation = parsed.sliceLocation;
              imagePositionPatient = parsed.imagePositionPatient;
              imageOrientationPatient = parsed.imageOrientationPatient;
              d = parsed.dataUrl;

              if (target === "patient" && parsed.meta) {
                const meta = parsed.meta;
                if (!extractedMeta) {
                  extractedMeta = { ...meta };
                } else {
                  if (!extractedMeta.patientName && meta.patientName) extractedMeta.patientName = meta.patientName;
                  if (!extractedMeta.studyDate && meta.studyDate) extractedMeta.studyDate = meta.studyDate;
                  if (!extractedMeta.age && meta.age) extractedMeta.age = meta.age;
                  if (!extractedMeta.birthDate && meta.birthDate) extractedMeta.birthDate = meta.birthDate;
                  if (!extractedMeta.sex && meta.sex) extractedMeta.sex = meta.sex;
                  if (!extractedMeta.detectedZone && meta.detectedZone) extractedMeta.detectedZone = meta.detectedZone;
                }

                if (meta.detectedZone) {
                  sliceZone = meta.detectedZone;
                  detectedZonesSet.add(sliceZone);
                }

                detectedSeq = parsed.detectedSeq || detectedSeq;
                detectedPlane = parsed.detectedPlane || detectedPlane;
              }
            }
          } catch (e) {
            console.warn("DICOM parse attempt failed for file:", f.name, e);
          }
        }
        
        // If not DICOM or Daikon couldn't render, only load standard images
        if (!d && (isStandardWebImage || f.type.startsWith("image/"))) {
          try {
            d = await new Promise((res, rej) => {
              const fr = new FileReader();
              fr.onload = e => res(e.target.result);
              fr.onerror = rej;
              fr.readAsDataURL(f);
            });
          } catch (e) {
            console.warn("Image read error:", f.name, e);
          }
        }

        // If we don't have a valid image dataURL, skip this non-image file
        if (!d || typeof d !== "string" || !d.startsWith("data:image/")) {
          continue;
        }

        processedCount++;
        const fin = (target === "patient" && anon) ? await anonymizeImage(d) : d;
        const zoneFinal = sliceZone || extractedMeta?.detectedZone || baseStudy?.zone || "knee";
        const obj = { 
          id: Date.now() + Math.random(), 
          name: f.name, 
          data: fin, 
          ts: Date.now(), 
          ps, 
          instanceNumber, 
          sliceLocation, 
          imagePositionPatient, 
          imageOrientationPatient,
          rows: sliceRows,
          cols: sliceCols,
          rawPixels: sliceRawPixels,
          wc: sliceWc,
          ww: sliceWw,
          minVal: sliceMinVal,
          maxVal: sliceMaxVal,
          isMonochrome1: sliceIsMono1,
          zone: zoneFinal
        };

        if (target === "ref") {
          setRefs(p => ({ ...p, [selZone]: [...(p[selZone] || []), obj] }));
        } else {
          const k = `${zoneFinal}__${detectedSeq}_${detectedPlane}`;
          if (!accumulatedSeries[k]) accumulatedSeries[k] = [];
          accumulatedSeries[k].push(obj);
        }
      }

      // Sort series slices spatially by instanceNumber or sliceLocation
      if (target === "patient") {
        for (const k of Object.keys(accumulatedSeries)) {
          accumulatedSeries[k].sort((a, b) => {
            if (a.imagePositionPatient && b.imagePositionPatient) {
              const dx = Math.abs(a.imagePositionPatient[0] - b.imagePositionPatient[0]);
              const dy = Math.abs(a.imagePositionPatient[1] - b.imagePositionPatient[1]);
              const dz = Math.abs(a.imagePositionPatient[2] - b.imagePositionPatient[2]);
              if (dx >= dy && dx >= dz) return a.imagePositionPatient[0] - b.imagePositionPatient[0];
              if (dy >= dx && dy >= dz) return a.imagePositionPatient[1] - b.imagePositionPatient[1];
              return a.imagePositionPatient[2] - b.imagePositionPatient[2];
            }
            if (a.sliceLocation != null && b.sliceLocation != null) {
              return a.sliceLocation - b.sliceLocation;
            }
            if (a.instanceNumber != null && b.instanceNumber != null) {
              return a.instanceNumber - b.instanceNumber;
            }
            return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
          });
        }
      }

      if (target === "patient") {
        setStudy(p => {
          const current = p || baseStudy || {};
          const allZones = Array.from(detectedZonesSet).filter(Boolean);
          const primaryZone = extractedMeta?.detectedZone || allZones[0] || current.zone || "knee";
          
          // Find best active series key that has images
          let activeKey = current.activeSeriesKey;
          if (!activeKey || !accumulatedSeries[activeKey] || accumulatedSeries[activeKey].length === 0) {
            // Prefer a series from the primary zone first
            const zoneKeys = Object.keys(accumulatedSeries).filter(k => k.startsWith(primaryZone + "__") && accumulatedSeries[k]?.length > 0);
            if (zoneKeys.length > 0) {
              activeKey = zoneKeys[0];
            } else {
              const anyKey = Object.keys(accumulatedSeries).find(k => accumulatedSeries[k] && accumulatedSeries[k].length > 0);
              if (anyKey) activeKey = anyKey;
            }
          }

          const parsedActive = parseSeriesKey(activeKey, primaryZone);
          const now = new Date();
          const defaultDate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

          return {
            ...current,
            patientName: (extractedMeta && extractedMeta.patientName) ? extractedMeta.patientName : (current.patientName || ""),
            date: (extractedMeta && extractedMeta.studyDate) ? extractedMeta.studyDate : (current.date || defaultDate),
            age: (extractedMeta && extractedMeta.age) ? extractedMeta.age : (current.age || ""),
            birthDate: (extractedMeta && extractedMeta.birthDate) ? extractedMeta.birthDate : (current.birthDate || ""),
            sex: (extractedMeta && extractedMeta.sex) ? extractedMeta.sex : (current.sex || ""),
            zone: parsedActive.zone || primaryZone,
            zones: allZones.length > 0 ? allZones : [primaryZone],
            activeSeq: parsedActive.seq,
            activePlane: parsedActive.plane,
            activeSeriesKey: activeKey,
            series: accumulatedSeries
          };
        });

        if (processedCount > 0) {
          flash(`Завантажено ${processedCount} зрізів (метадані оновлено)`);
        } else {
          flash("У вибраній папці не знайдено підтримуваних DICOM зрізів");
        }
      }
    } catch (err) {
      console.error("Upload failed with error:", err);
      flash("Помилка обробки файлів: " + (err.message || "невідома помилка"));
    } finally {
      setUploadProgress(null);
    }
  };

  const uploadPdf = async (file) => {
    if (!pdfOk || !file) return;
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    setPdfM({ pdf, tot: pdf.numPages, th: [], sel: new Set(), ld: true, pr: 0, nm: file.name });
    const th = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const vp = pg.getViewport({ scale: 0.35 });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      th.push({ p: i, d: c.toDataURL("image/jpeg", 0.5) });
      setPdfM(p => p ? { ...p, th: [...th], pr: Math.round((i / pdf.numPages) * 100) } : null);
    }
    setPdfM(p => p ? { ...p, ld: false } : null);
  };

  const addPdfPages = async () => {
    if (!pdfM || pdfM.sel.size === 0) return;
    const { pdf, sel, nm } = pdfM;
    setPdfM(p => p ? { ...p, ld: true, pr: 0 } : null);
    const sorted = [...sel].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < sorted.length; i++) {
      const pg = await pdf.getPage(sorted[i]);
      const vp = pg.getViewport({ scale: 1.5 });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      out.push({ id: Date.now() + Math.random(), name: `${nm} — стор. ${sorted[i]}`, data: c.toDataURL("image/jpeg", 0.95), ts: Date.now(), pg: sorted[i] });
      setPdfM(p => p ? { ...p, pr: Math.round(((i + 1) / sorted.length) * 100) } : null);
    }
    setRefs(p => ({ ...p, [selZone]: [...(p[selZone] || []), ...out] }));
    setPdfM(null);
    flash(`${out.length} стор. додано → "${ZONES[selZone].short}"`);
  };

  const appendDictatedText = (targetKey, text) => {
    const clean = (text || "").trim();
    if (!clean) return;
    if (targetKey === "doctorNotes") {
      setStudy((p) => {
        if (!p) return p;
        const updated = { ...p, doctorNotes: (p.doctorNotes ? p.doctorNotes + " " : "") + clean };
        dbPut("studies", String(p.id), updated).catch(() => {});
        return updated;
      });
    } else {
      setVnotes((p) => ({
        ...p,
        [targetKey]: (p[targetKey] ? p[targetKey].trimEnd() + " " : "") + clean
      }));
    }
  };

  const startVoice = async (targetKey) => {
    if (recording) {
      stopVoice();
      return;
    }

    // Prefer Gemini multimodal medical audio transcription when API key & MediaRecorder are available
    const canRecordAudio = typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof window !== "undefined" &&
      Boolean(window.MediaRecorder);

    if (apiKey && canRecordAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeOptions = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
        const chosenMime = mimeOptions.find((m) => window.MediaRecorder.isTypeSupported?.(m)) || "";
        const recorder = chosenMime ? new window.MediaRecorder(stream, { mimeType: chosenMime }) : new window.MediaRecorder(stream);
        const zoneName = ZONES[study?.zone]?.ua || "";

        audioChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setRecording(null);
          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          if (!chunks.length) return;

          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (blob.size < 400) return;

          setTranscribing(targetKey);
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const fr = new FileReader();
              fr.onload = () => resolve(fr.result);
              fr.onerror = reject;
              fr.readAsDataURL(blob);
            });
            const b64 = String(dataUrl).split(",")[1] || "";
            const text = await transcribeMedicalAudio({
              apiKey,
              audioBase64: b64,
              mimeType: blob.type || "audio/webm",
              zoneName
            });
            if (text) {
              appendDictatedText(targetKey, text);
              flash("Аудіо розпізнано");
            } else {
              flash("Мовлення не виявлено");
            }
          } catch (err) {
            console.error("Gemini audio transcription error:", err);
            flash(`Помилка розпізнавання аудіо: ${err.message || err}`);
          } finally {
            setTranscribing(null);
          }
        };

        mediaRecRef.current = recorder;
        recorder.start();
        setRecording(targetKey);
        return;
      } catch (micErr) {
        console.warn("MediaRecorder unavailable, falling back to Web Speech API:", micErr);
      }
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { flash("Голосовий ввід не підтримується"); return; }
    const r = new SR();
    r.lang = "uk-UA";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      appendDictatedText(targetKey, t);
    };
    r.onend = () => setRecording(null);
    r.onerror = () => setRecording(null);
    recRef.current = r;
    r.start();
    setRecording(targetKey);
  };

  const stopVoice = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
      mediaRecRef.current = null;
    }
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
      recRef.current = null;
    }
    setRecording(null);
  };

  const newStudy = () => {
    const now = new Date();
    const defaultDate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
    setStudy({ id: Date.now(), patientName: "", age: "", birthDate: "", sex: "", complaints: "", mechanism: "", zone: "knee", zones: ["knee"], activeSeq: "T2", activePlane: "Sag", activeSeriesKey: "knee__T2_Sag", series: {}, findings: null, keyImages: [], vnotes: {}, status: "draft", date: defaultDate });
    setVnotes({}); setScr("new");
  };

  const loadStudy = async (id) => {
    try {
      let saved = await dbGet("studies", String(id));
      // If id is a UUID, check Supabase for latest updates (e.g. attachments from mobile or notes from laptop)
      const isUuid = typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        try {
          const { data, error } = await supabase
            .from("studies")
            .select("*")
            .eq("id", id)
            .maybeSingle();

          if (data && !error) {
            let extra = null;
            const cleanFindings = (data.findings || []).filter(item => {
              if (item && item._extra) {
                extra = item._extra;
                return false;
              }
              return true;
            });

            const cloudStudy = {
              id: data.id,
              patientName: data.patient_name || saved?.patientName || "",
              age: data.age || saved?.age || "",
              complaints: data.complaints || saved?.complaints || "",
              mechanism: data.mechanism || saved?.mechanism || "",
              zone: data.zone || saved?.zone || "knee",
              zones: saved?.zones || [data.zone || "knee"],
              date: data.study_date || saved?.date || "",
              mriDate: data.mri_date || data.study_date || saved?.mriDate || "",
              findings: cleanFindings.length > 0 ? cleanFindings : (saved?.findings || []),
              summary: data.summary || saved?.summary || "",
              recommendation: data.recommendation || saved?.recommendation || "",
              keyImages: (data.key_images && data.key_images.length > 0) ? data.key_images : (saved?.keyImages || []),
              vnotes: { ...(saved?.vnotes || {}), ...(data.doctor_notes || {}) },
              doctorNotes: extra?.doctorNotesText || data.doctor_notes_text || saved?.doctorNotes || "",
              attachments: (extra?.attachments && extra.attachments.length > 0) ? extra.attachments : (saved?.attachments || []),
              conclusionReview: extra?.conclusionReview || saved?.conclusionReview || null,
              doctorReport: data.ai_report || saved?.doctorReport || null,
              archived: data.archived !== undefined ? data.archived : (saved?.archived || false),
              status: cleanFindings.length > 0 ? "done" : (saved?.status || "draft"),
              series: saved?.series || {}
            };

            saved = cloudStudy;
            try { await dbPut("studies", String(saved.id), saved); } catch {}
          }
        } catch (cErr) {
          console.warn("Cloud loadStudy sync error:", cErr);
        }
      }

      if (saved) {
        setStudy(saved);
        setVnotes(saved.vnotes || {});
        setConclusionReview(saved.conclusionReview || null);
        setScr("results");
      } else {
        flash("Дані дослідження не знайдено");
      }
    } catch (e) {
      console.error(e);
      flash("Помилка завантаження");
    }
  };

  const archiveStudy = async (id) => {
    const upd = studies.map(s => String(s.id) === String(id) ? { ...s, archived: true } : s);
    setStudies(upd);
    try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    try {
      const saved = await dbGet("studies", String(id));
      if (saved) await dbPut("studies", String(id), { ...saved, archived: true });
    } catch {}
    if (isUuid(id)) {
      try {
        await supabase.from("studies").update({ archived: true, updated_at: new Date().toISOString() }).eq("id", id);
      } catch (e) { console.warn("Supabase archive error:", e); }
    }
    flash("Дослідження відправлено в архів");
    if (String(study?.id) === String(id)) setScr("dash");
  };

  const unarchiveStudy = async (id) => {
    const upd = studies.map(s => String(s.id) === String(id) ? { ...s, archived: false } : s);
    setStudies(upd);
    try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    try {
      const saved = await dbGet("studies", String(id));
      if (saved) await dbPut("studies", String(id), { ...saved, archived: false });
    } catch {}
    if (isUuid(id)) {
      try {
        await supabase.from("studies").update({ archived: false, updated_at: new Date().toISOString() }).eq("id", id);
      } catch (e) { console.warn("Supabase unarchive error:", e); }
    }
    flash("Дослідження відновлено з архіву");
  };

  const deleteStudy = async (id) => {
    const upd = studies.filter(s => String(s.id) !== String(id));
    setStudies(upd);
    try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    try {
      const db = await openDB();
      const tx = db.transaction("studies", "readwrite");
      tx.objectStore("studies").delete(String(id));
    } catch {}
    if (isUuid(id)) {
      try {
        await supabase.from("studies").delete().eq("id", id);
      } catch (e) { console.warn("Supabase delete error:", e); }
    }
    flash("Дослідження видалено");
    if (String(study?.id) === String(id)) setScr("dash");
  };

  const [ocrLoading, setOcrLoading] = useState(false);

  const handleAttachment = async (files) => {
    if (!study) return;
    const attachments = [...(study.attachments || [])];
    for (const file of Array.from(files)) {
      let dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); });
      if (file.type.startsWith("image/")) {
        try {
          dataUrl = await compressImage(dataUrl, 1600, 0.82);
        } catch (e) {
          console.warn("Image compression error:", e);
        }
      }
      attachments.push({ id: Date.now() + Math.random(), name: file.name, type: file.type, data: dataUrl, ts: Date.now() });
    }
    const updatedStudy = { ...study, attachments };
    setStudy(updatedStudy);
    // Save updated study to local DB
    try { await dbPut("studies", String(study.id), updatedStudy); } catch {}

    let finalLocalAttachments = attachments;

    // Also sync to Supabase (offloading binary payloads to Storage when bucket is available)
    try {
      if (isUuid(study.id)) {
        const synced = await syncMediaListToStorage(study.id, "attachments", attachments);
        finalLocalAttachments = synced.localItems;
        const syncedStudy = { ...updatedStudy, attachments: finalLocalAttachments };
        setStudy(syncedStudy);
        try { await dbPut("studies", String(study.id), syncedStudy); } catch {}

        await supabase.from("studies").update({
          findings: [
            ...(study.findings || []).filter(item => !item?._extra),
            {
              _extra: {
                doctorNotesText: study.doctorNotes || "",
                attachments: synced.cloudItems,
                conclusionReview: conclusionReview || study.conclusionReview || null
              }
            }
          ],
          updated_at: new Date().toISOString()
        }).eq("id", study.id);
      }
    } catch (supaAttErr) {
      console.warn("Supabase attachment sync error:", supaAttErr);
    }

    flash(`Додано ${files.length} файл(ів) та синхронізовано з хмарою!`);
  };

  // Extract text from attached center's report via Gemini OCR and append to clinical card / doctorNotes
  const extractConclusionText = async () => {
    if (!apiKey) {
      flash("Будь ласка, вкажіть Gemini API ключ у налаштуваннях");
      return;
    }
    const rawAttachments = (study?.attachments || []).filter(a =>
      a && (a.data || a.url) && (
        a.type?.startsWith("image/") ||
        a.data?.startsWith("data:image/") ||
        a.type === "application/pdf" ||
        a.data?.startsWith("data:application/pdf") ||
        /\.(png|jpe?g|webp|pdf)$/i.test(a.name || a.url || "")
      )
    );
    if (rawAttachments.length === 0) {
      flash("Прикріпіть фото або PDF заключення МРТ центру");
      return;
    }

    setOcrLoading(true);
    try {
      const resolvedAttachments = [];
      for (const att of rawAttachments) {
        const data = await ensureAttachmentDataUrl(att);
        if (data) resolvedAttachments.push({ ...att, data });
      }
      if (resolvedAttachments.length === 0) {
        throw new Error("Не вдалося завантажити файли вкладення для розпізнавання");
      }
      const extractedText = await extractConclusionOcr({ apiKey, model: aiModel, attachments: resolvedAttachments });
      if (!extractedText) throw new Error("Не вдалося розпізнати текст на зображенні");

      const existingNotes = study.doctorNotes || "";
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${extractedText}` 
        : extractedText;

      const updatedStudy = { ...study, doctorNotes: updatedNotes };
      setStudy(updatedStudy);

      // Save locally
      try { await dbPut("studies", String(study.id), updatedStudy); } catch {}

      // Save to Supabase
      try {
        const isUuid = typeof study.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(study.id);
        if (isUuid) {
          await supabase.from("studies").update({
            findings: [
              ...(study.findings || []).filter(item => !item?._extra),
              {
                _extra: {
                  doctorNotesText: updatedNotes,
                  attachments: study.attachments || [],
                  conclusionReview: conclusionReview || study.conclusionReview || null
                }
              }
            ],
            updated_at: new Date().toISOString()
          }).eq("id", study.id);
        }
      } catch (cErr) {
        console.warn("Supabase ocr sync error:", cErr);
      }

      flash("Текст заключення успішно розпізнано та додано до картки!");
    } catch (err) {
      console.error(err);
      flash(`Помилка OCR: ${err.message || err}`);
    } finally {
      setOcrLoading(false);
    }
  };

  // AI review of center's conclusion
  const reviewConclusion = async () => {
    if (!apiKey || !study) return;
    const rawAttachments = study.attachments || [];
    if (rawAttachments.length === 0) { flash("Спочатку додайте заключення від центру"); return; }

    setReviewLoading(true);
    try {
      const resolvedAttachments = [];
      for (const att of rawAttachments) {
        const data = await ensureAttachmentDataUrl(att);
        if (data) resolvedAttachments.push({ ...att, data });
      }
      if (resolvedAttachments.length === 0) {
        throw new Error("Не вдалося завантажити файли заключення");
      }
      const rev = await reviewCenterConclusion({
        apiKey,
        model: aiModel,
        study,
        zoneName: ZONES[study.zone]?.ua || "",
        attachments: resolvedAttachments
      });
      setConclusionReview(rev);
      setStudy(p => p ? ({ ...p, conclusionReview: rev }) : p);
      try { await dbPut("studies", String(study.id), { ...study, conclusionReview: rev }); } catch {}
    } catch (err) {
      flash(`Помилка: ${err.message}`);
    } finally {
      setReviewLoading(false);
    }
  };

  // Confirm center's conclusion is correct and save as training data
  const confirmConclusion = async () => {
    if (!study) return;
    const trainingCase = {
      id: Date.now(),
      zone: study.zone,
      date: study.date,
      patientName: study.patientName,
      // Save only first 3 slices from each series as reference (to save space)
      sampleSlices: Object.entries(study.series || {}).slice(0, 2).flatMap(([k, imgs]) =>
        imgs.slice(0, 2).map(im => ({ seriesKey: k, data: im.data }))
      ),
      findings: study.findings || [],
      summary: study.summary || "",
      attachmentNames: (study.attachments || []).map(a => a.name),
      conclusionReview: conclusionReview,
      confirmedAt: Date.now(),
    };

    try {
      await dbPut("corrections", String(trainingCase.id), trainingCase);
      flash("✓ Випадок збережено для навчання ІІ");

      // Mark study as confirmed
      setStudy(p => ({ ...p, confirmed: true }));
      await dbPut("studies", String(study.id), { ...study, confirmed: true });
    } catch (err) {
      flash(`Помилка збереження: ${err.message}`);
    }
  };

  // Get past corrections for a zone (for few-shot learning)
  const getPastCorrections = async (zone) => {
    try {
      const all = await dbGetAll("corrections");
      return Object.values(all)
        .filter(c => c.zone === zone)
        .sort((a, b) => b.confirmedAt - a.confirmedAt)
        .slice(0, 5);
    } catch { return []; }
  };

  // ═══════════ ROI MARKER ═══════════
  const roiMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRoiStart({ x, y });
    setRoiDrawing(true);
    setRoi(null);
    setRoiResult(null);
  };

  
  
  const toolMouseDown = (e) => {
    if (toolMode === "roi") return roiMouseDown(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (toolMode === "measure_line") {
      setActiveMeasure({ startX: x, startY: y, endX: x, endY: y });
    } else if (toolMode === "measure_area") {
      setActiveArea({ startX: x, startY: y, endX: x, endY: y });
    } else if (toolMode === "measure_angle") {
      if (activeAngle.length === 0) {
        setActiveAngle([{x, y}]);
      } else if (activeAngle.length === 1) {
        setActiveAngle([activeAngle[0], {x, y}]);
      } else if (activeAngle.length === 2) {
        const pts = [activeAngle[0], activeAngle[1], {x, y}];
        const v1 = { x: pts[1].x - pts[0].x, y: pts[1].y - pts[0].y };
        const v2 = { x: pts[2].x - pts[0].x, y: pts[2].y - pts[0].y };
        const dot = v1.x*v2.x + v1.y*v2.y;
        const mag1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
        const mag2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);
        let deg = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
        if (isNaN(deg)) deg = 0;
        
        setMeasurements([...measurements, { type: "angle", pts, deg }]);
        setActiveAngle([]);
        setAngleMousePos(null);
      }
    }
  };

  const toolMouseMove = (e) => {
    if (toolMode === "roi") return roiMouseMove(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (toolMode === "measure_line" && activeMeasure) {
      setActiveMeasure({ ...activeMeasure, endX: x, endY: y });
    } else if (toolMode === "measure_area" && activeArea) {
      setActiveArea({ ...activeArea, endX: x, endY: y });
    } else if (toolMode === "measure_angle" && activeAngle.length > 0) {
      setAngleMousePos({ x, y });
    }
  };

  const toolMouseUp = async () => {
    if (toolMode === "roi") return roiMouseUp();
    
    const im = curImgs();
    const imgObj = im[splitIdx];
    if (!imgObj) return;
    
    const img = new window.Image();
    await new Promise(r => { img.onload = r; img.src = imgObj.data; });
    const imgW = img.width || imgObj.cols || 512;
    const imgH = img.height || imgObj.rows || 512;

    if (toolMode === "measure_line" && activeMeasure) {
      const dxImg = (activeMeasure.endX - activeMeasure.startX) * imgW;
      const dyImg = (activeMeasure.endY - activeMeasure.startY) * imgH;
      const distImg = Math.sqrt(dxImg * dxImg + dyImg * dyImg);

      let distMm = null;
      if (imgObj.ps && imgObj.ps.length >= 2) {
        const dxMm = dxImg * imgObj.ps[1];
        const dyMm = dyImg * imgObj.ps[0];
        distMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm);
      } else if (imgObj.ps && imgObj.ps.length >= 1) {
        distMm = distImg * imgObj.ps[0];
      }

      if (distImg > 3) {
        setMeasurements([...measurements, { type: "line", ...activeMeasure, mm: distMm, px: distImg }]);
      }
      setActiveMeasure(null);
      
    } else if (toolMode === "measure_area" && activeArea) {
      const rxImg = (Math.abs(activeArea.endX - activeArea.startX) * imgW) / 2;
      const ryImg = (Math.abs(activeArea.endY - activeArea.startY) * imgH) / 2;

      let areaMm2 = null;
      if (imgObj.ps && imgObj.ps.length >= 2) {
        areaMm2 = Math.PI * (rxImg * imgObj.ps[1]) * (ryImg * imgObj.ps[0]);
      } else if (imgObj.ps && imgObj.ps.length >= 1) {
        areaMm2 = Math.PI * (rxImg * imgObj.ps[0]) * (ryImg * imgObj.ps[0]);
      }

      if (rxImg > 2 && ryImg > 2) {
        setMeasurements([...measurements, { type: "area", ...activeArea, areaMm2 }]);
      }
      setActiveArea(null);
    }
  };


  const roiMouseMove = (e) => {
    if (!roiDrawing || !roiStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setRoi({
      x: Math.min(roiStart.x, x), y: Math.min(roiStart.y, y),
      w: Math.abs(x - roiStart.x), h: Math.abs(y - roiStart.y),
    });
  };

  const roiMouseUp = () => { setRoiDrawing(false); };

  const cropRoi = (imgData, roiRect) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        const sx = roiRect.x * img.width, sy = roiRect.y * img.height;
        const sw = roiRect.w * img.width, sh = roiRect.h * img.height;
        if (sw < 10 || sh < 10) { resolve(null); return; }
        c.width = sw; c.height = sh;
        c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(c.toDataURL("image/jpeg", 0.9));
      };
      img.src = imgData;
    });
  };

  const analyzeRoi = async () => {
    if (!apiKey || !roi || !study) return;
    const im = curImgs();
    if (!im[splitIdx]) return;

    setRoiLoading(true);
    try {
      const cropped = await cropRoi(im[splitIdx].data, roi);
      if (!cropped) { flash("Занадто мала ділянка"); setRoiLoading(false); return; }

      const prompt = getPromptRoi(ZONES[study.zone]?.group || "joints", ZONES[study.zone]?.ua || "Анатомія", seriesKey(), splitIdx + 1);
      const zoneAtlas = collectZoneMaterials(atlas, study.zone);
      const zoneRefs = collectZoneMaterials(refs, study.zone);
      const zoneKb = collectZoneMaterials(kb, study.zone);

      const result = await analyzeRoiRegion({
        apiKey,
        model: aiModel,
        prompt,
        zoneAtlas,
        zoneRefs,
        zoneKb,
        fullSliceDataUrl: im[splitIdx].data,
        croppedDataUrl: cropped
      });
      setRoiResult(result);
    } catch (err) {
      flash(`Помилка: ${err.message}`);
    } finally {
      setRoiLoading(false);
    }
  };

  const askManualAnatomy = async (queryText) => {
    if (!apiKey || !queryText.trim()) return;
    setRoiLoading(true);
    try {
      const prompt = getPromptManual(ZONES[study?.zone]?.group || "joints", queryText);
      const result = await askAnatomyQuestion({ apiKey, model: aiModel, prompt });
      setRoiResult(result);
      setManualQuery("");
    } catch (err) {
      flash(`Помилка: ${err.message}`);
    } finally {
      setRoiLoading(false);
    }
  };

  // Navigate to split view at specific slice
  const goToSlice = (sliceStr) => {
    // Parse "T2_Sag: 3-5" or "T2: 3-5" or "3-5" or "12"
    const keyMatch = sliceStr.match(/^([A-Z0-9\s_]+):\s*(\d+)/i);
    if (keyMatch) {
      const key = keyMatch[1].trim();
      const idx = parseInt(keyMatch[2]) - 1;
      if (study.series[key]) {
        const [seq, plane] = key.split("_");
        setStudy(p => ({ ...p, activeSeq: seq || p.activeSeq, activePlane: plane || p.activePlane }));
        setSplitIdx(Math.max(0, idx));
      }
    } else {
      const numMatch = sliceStr.match(/(\d+)/);
      if (numMatch) setSplitIdx(Math.max(0, parseInt(numMatch[1]) - 1));
    }
    setPrevScr("results");
    setScr("split");
  };

  const goSplit = (from) => { setSplitIdx(0); setRefIdx(0); setPrevScr(from); setScr("split"); };

  // Helpers for series
  const seriesKey = () => {
    if (study?.activeSeriesKey && study?.series?.[study.activeSeriesKey]) {
      return study.activeSeriesKey;
    }
    const zonePrefixed = `${study?.zone}__${study?.activeSeq}_${study?.activePlane}`;
    if (study?.series?.[zonePrefixed]) return zonePrefixed;
    const standard = `${study?.activeSeq}_${study?.activePlane}`;
    if (study?.series?.[standard]) return standard;
    return study?.activeSeriesKey || zonePrefixed;
  };
  const currentSliceKey = `${seriesKey()}-${splitIdx}`;
  const measurements = measurementsBySlice[currentSliceKey] || [];
  const setMeasurements = (nextOrUpdater) => {
    setMeasurementsBySlice(prev => {
      const curr = prev[currentSliceKey] || [];
      const next = typeof nextOrUpdater === "function" ? nextOrUpdater(curr) : nextOrUpdater;
      return { ...prev, [currentSliceKey]: next };
    });
  };
  const clearSliceMeasurements = () => setMeasurements([]);
    const sortSlices = (slices) => {
    if (!slices || slices.length <= 1) return slices || [];
    return [...slices].sort((a, b) => {
      // 1. Primary: Image Position (Patient) projected onto slice normal
      if (a.imagePositionPatient && b.imagePositionPatient) {
        // Detect dominant axis between the slices
        const dx = Math.abs(a.imagePositionPatient[0] - b.imagePositionPatient[0]);
        const dy = Math.abs(a.imagePositionPatient[1] - b.imagePositionPatient[1]);
        const dz = Math.abs(a.imagePositionPatient[2] - b.imagePositionPatient[2]);
        if (dx >= dy && dx >= dz) return a.imagePositionPatient[0] - b.imagePositionPatient[0];
        if (dy >= dx && dy >= dz) return a.imagePositionPatient[1] - b.imagePositionPatient[1];
        return a.imagePositionPatient[2] - b.imagePositionPatient[2];
      }
      // 2. Secondary: Slice Location
      if (a.sliceLocation !== null && a.sliceLocation !== undefined && b.sliceLocation !== null && b.sliceLocation !== undefined) {
        return a.sliceLocation - b.sliceLocation;
      }
      // 3. Tertiary: Instance Number
      if (a.instanceNumber !== null && a.instanceNumber !== undefined && b.instanceNumber !== null && b.instanceNumber !== undefined) {
        return a.instanceNumber - b.instanceNumber;
      }
      // 4. Fallback: filename natural sort (e.g. IMG001, IMG002 or 1.dcm, 2.dcm)
      return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
    });
  };
  const curImgs = () => sortSlices(study?.series?.[seriesKey()]);
  const allImgs = () => Object.entries(study?.series || {}).flatMap(([key, imgs]) => imgs.map(im => ({ ...im, seriesKey: key })));
  const totalCount = () => Object.values(study?.series || {}).reduce((s, a) => s + a.length, 0);
  const seriesCounts = () => {
    const c = {};
    Object.entries(study?.series || {}).forEach(([k, v]) => { if (v.length > 0) c[k] = v.length; });
    return c;
  };

  const analyze = async () => {
    if (!apiKey) { setShowSet(true); return; }
    const zrefs = collectZoneMaterials(refs, study.zone);
    const all = allImgs();
    if (!all.length) return;
    setScr("loading"); setProg({ s: "send", p: 10 });

    const usedSeqs = Object.entries(study.series).filter(([_, a]) => a.length > 0).map(([s]) => s);

    try {
      const pastCases = await getPastCorrections(study.zone);
      const zoneKb = collectZoneMaterials(kb, study.zone);

      setProg({ s: "send", p: 20 });
      const j = await analyzeStudy({
        apiKey,
        model: aiModel,
        study,
        zoneName: ZONES[study.zone].ua,
        usedSeqs,
        zrefs,
        zoneKb,
        pastCases,
        vnotes,
        sysPrompt: SYS_PROMPT,
        onProgress: setProg
      });

      const updatedStudy = {
        ...study,
        findings: j.findings || [],
        summary: j.summary,
        recommendation: j.recommendation,
        radio: j.radiopaedia_terms || [],
        status: "done"
      };
      setStudy(updatedStudy);

      setProg(null); setScr("results");
      // Save full study to IndexedDB
      try {
        await dbPut("studies", String(updatedStudy.id), updatedStudy);
      } catch {}
      const fc = (updatedStudy.findings || []).length;
      const meta = { id: updatedStudy.id, pn: updatedStudy.patientName, z: updatedStudy.zone, d: updatedStudy.date, mriDate: updatedStudy.mriDate || updatedStudy.date, ic: all.length, fc, archived: updatedStudy.archived || false };
      const upd = [meta, ...studies.filter(x => String(x.id) !== String(updatedStudy.id)).slice(0, 24)];
      setStudies(upd);
      try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    } catch (err) {
      setProg(null);
      setStudy(p => ({ ...p, findings: [{ id: 1, structure: "Помилка", description: err.message, slices: "-", confidence_level: 0, severity: "normal" }], status: "done" }));
      setScr("results");
    }
  };

  // ═══════════ PDF REPORT GENERATION ═══════════

  const generateReport = async (type = "clinical") => {
    if (!study) return;
    flash("Генерація звіту...");
    const opened = openPrintableReport({
      study,
      vnotes,
      conclusionReview,
      type,
      totalSlices: totalCount()
    });
    if (opened) {
      flash("Звіт відкрито → Ctrl+P або кнопка «Зберегти у PDF»");
    } else {
      flash("Дозвольте спливаючі вікна для цього сайту");
    }
  };

  // ═══════════ ARCHIVE (File System Access API) ═══════════
  const loadArchive = async (handle) => {
    try {
      const patients = [];
      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') patients.push(entry);
      }
      setArchivePatients(patients.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error(e); flash("Помилка читання архіву"); }
  };

  const linkArchive = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await dbPut("archive", "root_handle", handle);
      setArchiveHandle(handle);
      setArchiveStatus("ready");
      loadArchive(handle);
      flash("Архів успішно прив'язано");
    } catch (e) { if (e.name !== 'AbortError') flash("Відмінено"); }
  };

  const restoreArchiveAccess = async () => {
    if (!archiveHandle) return;
    try {
      const perm = await archiveHandle.requestPermission({ mode: 'read' });
      if (perm === 'granted') {
        setArchiveStatus("ready");
        loadArchive(archiveHandle);
      } else {
        flash("Доступ не надано");
      }
    } catch (e) { flash("Помилка доступу"); }
  };

  const unlinkArchive = async () => {
    try {
      const db = await openDB();
      db.transaction("archive", "readwrite").objectStore("archive").delete("root_handle");
      setArchiveHandle(null);
      setArchiveStatus("none");
      setArchivePatients([]);
      flash("Архів відв'язано");
    } catch (e) {}
  };

  const getFilesRecursively = async (dirHandle) => {
    let files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        files.push(await entry.getFile());
      } else if (entry.kind === 'directory') {
        files.push(...await getFilesRecursively(entry));
      }
    }
    return files;
  };

  const openPatientFromArchive = async (dirHandle) => {
    setArchiveLoading(true);
    flash(`Завантаження досліджень для ${dirHandle.name.replace(/_/g, " ")}...`);
    try {
      const files = await getFilesRecursively(dirHandle);
      if (files.length === 0) { flash("Папка порожня"); return; }
      
      const now = new Date();
      const defaultDate = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
      const initial = {
        id: Date.now(),
        patientName: dirHandle.name.replace(/_/g, " "),
        age: "",
        birthDate: "",
        sex: "",
        complaints: "",
        mechanism: "",
        zone: "knee",
        zones: ["knee"],
        activeSeq: "T2",
        activePlane: "Sag",
        activeSeriesKey: "knee__T2_Sag",
        series: {},
        findings: null,
        keyImages: [],
        vnotes: {},
        status: "draft",
        date: defaultDate
      };
      
      setStudy(initial);
      setVnotes({});
      setScr("new");
      
      await uploadImgs(files, "patient", initial);
      flash(`Успішно завантажено дослідження (${files.length} файлів)`);
    } catch (e) {
      console.error(e);
      flash("Помилка завантаження файлів");
    } finally {
      setArchiveLoading(false);
    }
  };

  // ═══════════ VIEWER HELPERS (zoom/pan/wheel) ═══════════
  const getZoom = (side) => side === "L" ? zoomL : zoomR;
  const setZoom = (side, val) => side === "L" ? setZoomL(val) : setZoomR(val);

  // Wheel: scroll = navigate slices, Ctrl+wheel = zoom
  const onViewerWheel = (side, e, navFn, count) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const z = getZoom(side);
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.max(1, Math.min(6, z.scale * delta));
      // reset pan if back to 1
      if (newScale === 1) setZoom(side, { scale: 1, x: 0, y: 0 });
      else setZoom(side, { ...z, scale: newScale });
    } else {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      navFn(dir, count);
    }
  };

  const resetZoom = (side) => setZoom(side, { scale: 1, x: 0, y: 0 });

  // Pan when zoomed
  const onViewerPanStart = (side, e) => {
    const z = getZoom(side);
    if (z.scale <= 1) return;
    setPanning({ side, startX: e.clientX, startY: e.clientY, origX: z.x, origY: z.y });
  };
  const onViewerPanMove = (e) => {
    if (!panning) return;
    const z = getZoom(panning.side);
    setZoom(panning.side, { ...z, x: panning.origX + (e.clientX - panning.startX), y: panning.origY + (e.clientY - panning.startY) });
  };
  const onViewerPanEnd = () => setPanning(null);

  const onWindowStart = (side, e, activeSlice = null) => {
    e.preventDefault();
    const orig = side === "L" ? wlL : wlR;
    const hasRaw = Boolean(activeSlice?.rawPixels && activeSlice.wc != null && activeSlice.ww != null);
    const baseWc = orig.wc ?? activeSlice?.wc ?? 0;
    const baseWw = orig.ww ?? activeSlice?.ww ?? 1;
    const range = hasRaw && activeSlice.maxVal != null && activeSlice.minVal != null
      ? Math.max(20, activeSlice.maxVal - activeSlice.minVal)
      : Math.max(100, baseWw);
    setWindowing({
      side,
      startX: e.clientX,
      startY: e.clientY,
      origB: orig.b,
      origC: orig.c,
      hasRaw,
      origWc: baseWc,
      origWw: baseWw,
      range
    });
  };

  const onWindowMove = (e) => {
    if (!windowing) return;
    const deltaX = e.clientX - windowing.startX;
    const deltaY = e.clientY - windowing.startY;
    const setter = windowing.side === "L" ? setWlL : setWlR;

    if (windowing.hasRaw) {
      const step = windowing.range / 350;
      const newWc = windowing.origWc + deltaY * step;
      const newWw = Math.max(4, windowing.origWw + deltaX * step * 1.4);
      setter((prev) => ({ ...prev, wc: newWc, ww: newWw, preset: "custom" }));
    } else {
      const newB = Math.max(10, Math.min(400, windowing.origB - deltaY * 0.7));
      const newC = Math.max(10, Math.min(400, windowing.origC + deltaX * 0.7));
      setter((prev) => ({ ...prev, b: newB, c: newC }));
    }
  };

  const onWindowEnd = () => setWindowing(null);


  
  const generateAiReport = async () => {
    if (!apiKey) { flash("Введіть ваш API ключ"); return; }
    if (!study) return;
    setReportLoading(true);
    setShowReport(true);
    setReportText("");
    
    try {
      const resText = await generateMedicalProtocol({
        apiKey,
        model: aiModel,
        study,
        zoneName: ZONES[study.zone]?.ua || "Невідома зона",
        vnotes
      });
      setReportText(resText);
    } catch (e) {
      setReportText(`Помилка: ${e.message}`);
    } finally {
      setReportLoading(false);
    }
  };


  const value = {
    scr, setScr,
    apiKey, setApiKey,
    archiveHandle, setArchiveHandle,
    archiveStatus, setArchiveStatus,
    archivePatients, setArchivePatients,
    archiveLoading, setArchiveLoading,
    uploadProgress,
    cloudSyncStatus, setCloudSyncStatus,
    apiKeyIn, setApiKeyIn,
    aiModel, setAiModel,
    refs, setRefs,
    atlas, setAtlas,
    kb, setKb,
    libTab, setLibTab,
    selZone, setSelZone,
    expandedSubs, setExpandedSubs,
    studies, setStudies,
    study, setStudy,
    prog, setProg,
    viewImg, setViewImg,
    showSet, setShowSet,
    anon, setAnon,
    splitIdx, setSplitIdx,
    refIdx, setRefIdx,
    showRefP, setShowRefP,
    prevScr, setPrevScr,
    vnotes, setVnotes,
    recording, setRecording, transcribing,
    pdfM, setPdfM,
    pdfOk, setPdfOk,
    toast, setToast,
    rf, setRf, rt, setRt,
    showArchive, setShowArchive,
    conclusionReview, setConclusionReview,
    reviewLoading, setReviewLoading,
    roi, setRoi,
    roiDrawing, setRoiDrawing,
    roiStart, setRoiStart,
    roiResult, setRoiResult,
    roiLoading, setRoiLoading,
    manualQuery, setManualQuery,
    zoomL, setZoomL,
    wlL, setWlL,
    wlR, setWlR,
    windowing, setWindowing,
    rightMode, setRightMode,
    compareSeriesKey, setCompareSeriesKey,
    compareIdx, setCompareIdx,
    syncScroll, setSyncScroll,
    reportLoading, setReportLoading,
    reportText, setReportText,
    showReport, setShowReport,
    aiMarkers, setAiMarkers,
    aiScanning, setAiScanning,
    toolMode, setToolMode,
    measurements, setMeasurements, measurementsBySlice, clearSliceMeasurements,
    confirmDialog, setConfirmDialog, askConfirm,
    activeMeasure, setActiveMeasure,
    activeArea, setActiveArea,
    activeAngle, setActiveAngle,
    angleMousePos, setAngleMousePos,
    zoomR, setZoomR,
    panning, setPanning,
    refSource, setRefSource,
    refIn, pdfIn, patIn, folderIn, recRef, attachIn, atlasIn,
    roiImgRef,
    flash, saveKey,
    uploadImgs, uploadPdf, addPdfPages,
    startVoice, stopVoice,
    newStudy, loadStudy, archiveStudy, unarchiveStudy, deleteStudy,
    handleAttachment, reviewConclusion, confirmConclusion, getPastCorrections,
    extractConclusionText, ocrLoading,
    toolMouseDown, toolMouseMove, toolMouseUp,
    roiMouseDown, roiMouseMove, roiMouseUp,
    analyzeRoi, askManualAnatomy,
    goToSlice, goSplit,
    seriesKey, sortSlices, curImgs, allImgs, totalCount, seriesCounts,
    analyze, generateReport, generateAiReport,
    onViewerWheel, resetZoom, onViewerPanStart, onViewerPanMove, onViewerPanEnd,
    onWindowStart, onWindowMove, onWindowEnd,
    loadArchive, linkArchive, restoreArchiveAccess, unlinkArchive, openPatientFromArchive,
    fetchCloudStudies, syncingCloud,
    isLocked, setIsLocked
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
