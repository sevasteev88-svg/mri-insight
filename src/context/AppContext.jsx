import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import daikon from "daikon";
import { supabase } from "../services/supabase.js";
import { openDB, dbGet, dbPut, dbGetAll } from "../services/db.js";
import { ZONES, parseSeriesKey, formatSeriesLabel } from "../constants/anatomy.js";
import { getSysPromptAnalyze, getPromptRoi, getPromptManual } from "../constants/prompts.js";
import { anonymizeImage, collectZoneMaterials, confColor, compressImage } from "../utils/helpers.js";
import { extractDicomMetadata } from "../utils/dicomMeta.js";
import { STRUCTURED_KB } from "../constants/anatomy_kb.js";

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
  const [apiKeyIn, setApiKeyIn] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.5-flash");
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
  const [wlL, setWlL] = useState({ b: 100, c: 100 });
  const [wlR, setWlR] = useState({ b: 100, c: 100 });
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
  const [measurements, setMeasurements] = useState([]);
  const [activeMeasure, setActiveMeasure] = useState(null);
  const [activeArea, setActiveArea] = useState(null);
  const [activeAngle, setActiveAngle] = useState([]);
  const [angleMousePos, setAngleMousePos] = useState(null);
  const [zoomR, setZoomR] = useState({ scale: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(null); // {side, startX, startY, origX, origY}
  const [refSource, setRefSource] = useState("refs"); // "refs" | "atlas" | "kb"

  const refIn = useRef(null), pdfIn = useRef(null), patIn = useRef(null), folderIn = useRef(null), recRef = useRef(null), attachIn = useRef(null), atlasIn = useRef(null);
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


const INITIAL_KB = {
  c_spine: [{ id: "c_spine_1", title: "Класифікація гриж дисків", text: "Протрузія: ширина основи більша за випинання.\nЕкструзія: випинання більше за основу.\nСеквестр: відокремлений фрагмент.\nОцінюйте вплив на дуральний мішок та корінці." }],
  l_spine: [
    { id: "l_spine_1", title: "Дегенерація за Modic", text: "Modic I: набряк (T1 гіпо, T2 гіпер).\nModic II: жирова дегенерація (T1 гіпер, T2 гіпер/ізо).\nModic III: склероз (T1 гіпо, T2 гіпо)." },
    { id: "l_spine_2", title: "Критерії гриж міжхребцевих дисків", text: "Протрузія: випинання < 50% окружності, основа ширша за глибину.\nЕкструзія: випинання більше за основу (ризик секвестрації).\nОцінюйте латеральний канал та компресію спинномозкового корінця." }
  ],
  shoulder: [
    { id: "shoulder_1", title: "Обертальна манжета", text: "Супраспінатус — найчастіша локалізація розривів. Оцінюйте: частковий (суглобова/бурсальна поверхня) чи повношаровий. Звертайте увагу на ретракцію м'яза та жирову атрофію (за Goutallier)." },
    { id: "shoulder_2", title: "Labrum та SLAP-ушкодження", text: "Верхня губа (SLAP): розрив на 10-2 годинах. Часто поєднується з відривом сухожилля біцепса. Оцінюйте аксіальні та косі коронарні PDFS." }
  ],
  knee: [
    { id: "knee_1", title: "ПХЗ (ACL) — критерії розриву", text: "Повний розрив: відсутність безперервності волокон на сагіталі, симптом 'порожньої вирізки', kissing contusions латерального виростка стегна і заднього краю плато великогомілкової кістки." },
    { id: "knee_2", title: "Меніски за Stoller", text: "Stoller I: точковий сигнал без контакту з поверхнею.\nStoller II: лінійний внутрішній сигнал (дегенерація).\nStoller III: істинний розрив — вихід гіперінтенсивної лінії на суглобову поверхню." }
  ],
  hip: [
    { id: "hip_1", title: "ФАІ та вертлюжна губа", text: "CAM-деформація: асферичність переходу голівка-шийка (кут альфа > 55°).\nPincer: надмірне перекриття вертлюжної западини.\nРозрив губи: найчастіше передньо-верхній сегмент." }
  ],
  ankle: [
    { id: "ankle_1", title: "Зв'язки латерального комплексу", text: "ATFL (передня таранно-малогомілкова) — ушкоджується першою при супінації. Оцінюйте аксіальний PDFS.\nCFL (п'ятково-малогомілкова) — коронарний та аксіальний зрізи." }
  ]
};

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
      try { const r = localStorage.getItem("mri-model"); if (r) setAiModel(r); } catch {}
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
    // Filter files: exclude known non-image files like DICOMDIR, desktop.ini, DS_Store
    const list = Array.from(files).filter(f => {
      const nm = f.name.toUpperCase();
      if (nm === "DICOMDIR" || nm === "DESKTOP.INI" || nm === ".DS_STORE" || nm.endsWith(".TXT") || nm.endsWith(".PDF")) return false;
      return true;
    });

    if (list.length === 0) return;
    
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

    for (const f of list) {
      let d = null;
      let detectedSeq = "T2";
      let detectedPlane = "Sag";
      let sliceZone = null;
      let ps = null;
      let instanceNumber = null;
      let sliceLocation = null;
      let imagePositionPatient = null;
      let isDicom = false;

      // Attempt DICOM parsing for all files unless explicitly standard web images
      const isStandardWebImage = f.type.startsWith("image/png") || f.type.startsWith("image/jpeg") || f.type.startsWith("image/webp");

      if (!isStandardWebImage) {
        try {
          const buf = await f.arrayBuffer();
          const data = new DataView(buf);
          const image = daikon.Series.parseImage(data);
          if (image) {
            isDicom = true;
            if (target === "patient") {
              const meta = extractDicomMetadata(image);
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

              const desc = (meta.seriesDescription || "").toLowerCase();
              if (desc.includes("t2") || desc.includes("t 2")) detectedSeq = "T2";
              else if (desc.includes("t1") || desc.includes("t 1")) detectedSeq = "T1";
              else if (desc.includes("stir")) detectedSeq = "STIR";
              else if (desc.includes("pd")) {
                if (desc.includes("fs") || desc.includes("fat")) detectedSeq = "PD Fat Sat";
                else detectedSeq = "PD";
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

            // Extract spatial sorting metadata
            const inTag = image.getTag(0x0020, 0x0013); // Instance Number
            if (inTag && inTag.value && inTag.value[0] !== undefined) {
              const parsed = parseInt(inTag.value[0], 10);
              if (!isNaN(parsed)) instanceNumber = parsed;
            }

            const slTag = image.getTag(0x0020, 0x1041); // Slice Location
            if (slTag && slTag.value && slTag.value[0] !== undefined) {
              const parsed = parseFloat(slTag.value[0]);
              if (!isNaN(parsed)) sliceLocation = parsed;
            }

            const ippTag = image.getTag(0x0020, 0x0032); // Image Position (Patient)
            if (ippTag && ippTag.value && ippTag.value.length >= 3) {
              imagePositionPatient = [
                parseFloat(ippTag.value[0]),
                parseFloat(ippTag.value[1]),
                parseFloat(ippTag.value[2])
              ];
            }

            const rawData = image.getInterpretedData();
            if (rawData && image.getCols() > 0 && image.getRows() > 0) {
              const c = document.createElement("canvas");
              c.width = image.getCols();
              c.height = image.getRows();
              const ctx = c.getContext("2d");
              const imgData = ctx.createImageData(c.width, c.height);
              let min = Infinity, max = -Infinity;
              for (let i = 0; i < rawData.length; i++) {
                if (rawData[i] < min) min = rawData[i];
                if (rawData[i] > max) max = rawData[i];
              }
              let psTag = image.getTag(0x0028, 0x0030);
              if (psTag && psTag.value) {
                if (Array.isArray(psTag.value) && psTag.value.length >= 2) ps = [parseFloat(psTag.value[0]), parseFloat(psTag.value[1])];
                else if (typeof psTag.value[0] === 'string') {
                  const parts = psTag.value[0].split('\\');
                  if (parts.length >= 2) ps = [parseFloat(parts[0]), parseFloat(parts[1])];
                }
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
              for (let i = 0; i < rawData.length; i++) {
                let val = rawData[i];
                let n = ((val - minP) / ww) * 255;
                if (n < 0) n = 0; if (n > 255) n = 255;
                const idx = i * 4;
                imgData.data[idx] = n; imgData.data[idx + 1] = n; imgData.data[idx + 2] = n; imgData.data[idx + 3] = 255;
              }
              ctx.putImageData(imgData, 0, 0);
              d = c.toDataURL("image/jpeg", 0.9);
            }
          }
        } catch(e) {
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
      const obj = { id: Date.now() + Math.random(), name: f.name, data: fin, ts: Date.now(), ps, instanceNumber, sliceLocation, imagePositionPatient, zone: zoneFinal };

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

  const startVoice = (idx) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { flash("Голосовий ввід не підтримується"); return; }
    const r = new SR(); r.lang = "uk-UA"; r.continuous = true; r.interimResults = false;
    r.onresult = e => { const t = Array.from(e.results).map(x => x[0].transcript).join(" "); setVnotes(p => ({ ...p, [idx]: (p[idx] || "") + " " + t })); };
    r.onend = () => setRecording(null); r.onerror = () => setRecording(null);
    recRef.current = r; r.start(); setRecording(idx);
  };
  const stopVoice = () => { if (recRef.current) recRef.current.stop(); setRecording(null); };

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
    const upd = studies.map(s => s.id === id ? { ...s, archived: true } : s);
    setStudies(upd);
    try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    flash("Дослідження відправлено в архів");
    if (study?.id === id) setScr("dash");
  };

  const unarchiveStudy = async (id) => {
    const upd = studies.map(s => s.id === id ? { ...s, archived: false } : s);
    setStudies(upd);
    try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    flash("Дослідження відновлено з архіву");
  };

  const deleteStudy = async (id) => {
    const upd = studies.filter(s => s.id !== id);
    setStudies(upd);
    try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    try {
      const db = await openDB();
      const tx = db.transaction("studies", "readwrite");
      tx.objectStore("studies").delete(String(id));
    } catch {}
    flash("Дослідження видалено");
    if (study?.id === id) setScr("dash");
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

    // Also sync to Supabase if study.id is a UUID or exists in cloud
    try {
      const isUuid = typeof study.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(study.id);
      if (isUuid) {
        await supabase.from("studies").update({
          findings: [
            ...(study.findings || []),
            {
              _extra: {
                doctorNotesText: study.doctorNotes || "",
                attachments: attachments,
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
    const attachments = (study?.attachments || []).filter(a => a.data && (a.type?.startsWith("image/") || a.data.startsWith("data:image/") || a.type === "application/pdf" || a.data.startsWith("data:application/pdf")));
    if (attachments.length === 0) {
      flash("Прикріпіть фото або PDF заключення МРТ центру");
      return;
    }

    setOcrLoading(true);
    try {
      const parts = [{
        text: `Ти висококваліфікований медичний секретар та асистент радіолога.
Перед тобою офіційний документ: медичний висновок (протокол) МРТ діагностичного центру.

ТВОЄ ЗАВДАННЯ:
1. Прочитай та витягни ПОВНИЙ ТЕКСТ усього документа від початку до кінця (OCR), нічого не скорочуючи і не обриваючи!
2. Обов'язково прочитай весь розділ знахідок: кістки, меніски (медіальний/латеральний), зв'язки (ПХЗ, ЗХЗ, колатеральні), сухожилля, капсулу, суглобовий хрящ, наявність випоту.
3. Обов'язково дослівно або максимально точно випиши підсумковий блок «ВИСНОВОК» (ЗАКЛЮЧЕННЯ) діагностичного центру.
4. Оформи структуровано, красиво та акуратно українською мовою:

--- ЗАКЛЮЧЕННЯ МРТ ЦЕНТРУ ---
• Пацієнт / Дата / Апарат / Контраст / Зона
• Протокол дослідження (імпульсні послідовності)
• Опис виявлених змін (детально за анатомічними структурами)
• ВИСНОВОК ЦЕНТРУ (повне заключення лікаря-рентгенолога)

Виводь тільки структурований текст висновку, без жодних вступних слів чи коментарів від себе.`
      }];

      for (const att of attachments) {
        if (att.data && att.data.includes(",")) {
          const mime = att.type || (att.data.startsWith("data:image/png") ? "image/png" : att.data.startsWith("data:application/pdf") ? "application/pdf" : "image/jpeg");
          parts.push({
            inline_data: {
              mime_type: mime.startsWith("application/pdf") ? "application/pdf" : "image/jpeg",
              data: att.data.split(",")[1]
            }
          });
        }
      }

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
        })
      });

      const data = await resp.json();
      if (data?.error) throw new Error(data.error.message);

      const extractedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!extractedText.trim()) throw new Error("Не вдалося розпізнати текст на зображенні");

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
    const attachments = study.attachments || [];
    if (attachments.length === 0) { flash("Спочатку додайте заключення від центру"); return; }

    setReviewLoading(true);
    try {
      const parts = [];
      parts.push({ text: `Ти досвідчений радіолог. Тобі надано:
1. Заключення МРТ від діагностичного центру (фото або PDF)
2. Результати твого попереднього аналізу знімків цього пацієнта

Порівняй заключення центру зі своїми знахідками. Відповідай ТІЛЬКИ валідним JSON українською:
{
  "overall_agreement": "agree|partial|disagree",
  "overall_comment": "Загальна оцінка",
  "details": [
    {"point": "Що саме порівнюєш", "center_says": "Що написав центр", "ai_says": "Що вважаєш ти", "agreement": "agree|disagree", "comment": "Коментар"}
  ],
  "missed_by_center": ["Що центр міг пропустити"],
  "missed_by_ai": ["Що ІІ міг пропустити"],
  "recommendation": "Загальна рекомендація"
}` });

      parts.push({ text: `\n--- РЕЗУЛЬТАТИ ІІ АНАЛІЗУ ---\nЗона: ${ZONES[study.zone]?.ua}\nЗнахідки: ${JSON.stringify(study.findings || [])}\nВисновок ІІ: ${study.summary || "немає"}\n` });

      parts.push({ text: "\n--- ЗАКЛЮЧЕННЯ ВІД ЦЕНТРУ ---" });
      for (const att of attachments) {
        if (att.type.startsWith("image/")) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: att.data.split(",")[1] } });
        } else if (att.type === "application/pdf") {
          parts.push({ inline_data: { mime_type: "application/pdf", data: att.data.split(",")[1] } });
        }
      }

      parts.push({ text: "\nПорівняй заключення центру зі своїми знахідками. Будь детальним." });

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.15, maxOutputTokens: 8192 } })
      });

      const data = await resp.json();
      if (data?.error) throw new Error(data.error.message);

      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        setConclusionReview(JSON.parse(clean));
      } catch {
        setConclusionReview({ overall_agreement: "partial", overall_comment: clean, details: [], missed_by_center: [], missed_by_ai: [], recommendation: "" });
      }

      // Save review to study
      try { await dbPut("studies", String(study.id), { ...study, conclusionReview: JSON.parse(clean) }); } catch {}
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
    const rect = roiImgRef.current.getBoundingClientRect();
    const scaleX = rect.width / (img.width || 512);
    const scaleY = rect.height / (img.height || 512);

    if (toolMode === "measure_line" && activeMeasure) {
      const dxScreen = (activeMeasure.endX - activeMeasure.startX) * rect.width;
      const dyScreen = (activeMeasure.endY - activeMeasure.startY) * rect.height;
      const distScreen = Math.sqrt(dxScreen*dxScreen + dyScreen*dyScreen);
      const distImg = distScreen / (scaleX || 1); // Assuming uniform scale mostly
      
      let distMm = null;
      if (imgObj.ps && imgObj.ps.length >= 1) distMm = distImg * imgObj.ps[0];
      
      if (distScreen > 5) {
        setMeasurements([...measurements, { type: "line", ...activeMeasure, mm: distMm, px: distImg }]);
      }
      setActiveMeasure(null);
      
    } else if (toolMode === "measure_area" && activeArea) {
      const dxScreen = Math.abs(activeArea.endX - activeArea.startX) * rect.width;
      const dyScreen = Math.abs(activeArea.endY - activeArea.startY) * rect.height;
      const rxImg = (dxScreen / 2) / (scaleX || 1);
      const ryImg = (dyScreen / 2) / (scaleY || 1);
      
      let areaMm2 = null;
      if (imgObj.ps && imgObj.ps.length >= 2) {
        areaMm2 = Math.PI * (rxImg * imgObj.ps[0]) * (ryImg * imgObj.ps[1]);
      } else if (imgObj.ps && imgObj.ps.length >= 1) {
        areaMm2 = Math.PI * (rxImg * imgObj.ps[0]) * (ryImg * imgObj.ps[0]);
      }
      
      if (dxScreen > 5 && dyScreen > 5) {
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

      const parts = [];
      parts.push({ text: getPromptRoi(ZONES[study.zone]?.group || "joints", ZONES[study.zone]?.ua || "Анатомія", seriesKey(), splitIdx + 1) });

      // Send atlas images (labeled anatomy references) — includes related detailed structures
      const zoneAtlas = collectZoneMaterials(atlas, study.zone);
      if (zoneAtlas.length > 0) {
        parts.push({ text: "\n--- АНАТОМІЧНИЙ АТЛАС (підписані структури для орієнтації) ---" });
        for (const a of zoneAtlas.slice(0, 12)) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: a.data.split(",")[1] } });
          if (a.label) parts.push({ text: `Підпис: ${a.label}` });
        }
      }

      // Send reference normal images if available
      const zoneRefs = collectZoneMaterials(refs, study.zone);
      if (zoneRefs.length > 0) {
        parts.push({ text: "\n--- РЕФЕРЕНСИ НОРМИ (для порівняння) ---" });
        for (const r of zoneRefs.slice(0, 5)) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: r.data.split(",")[1] } });
        }
      }

      // Knowledge base rules — includes related detailed structures
      const zoneKb = collectZoneMaterials(kb, study.zone);
      if (zoneKb.length > 0) {
        parts.push({ text: "\n--- БАЗА ЗНАНЬ (діагностичні критерії) ---\n" + zoneKb.map(e => `[${e.title}]\n${e.text}`).join("\n\n") + "\n" });
      }

      // Send full slice for context
      parts.push({ text: "\n--- ПОВНИЙ ЗРІЗ (для контексту) ---" });
      parts.push({ inline_data: { mime_type: "image/jpeg", data: im[splitIdx].data.split(",")[1] } });

      // Send cropped ROI
      parts.push({ text: "\n--- ВИДІЛЕНА ДІЛЯНКА (пріоритет аналізу) ---" });
      parts.push({ inline_data: { mime_type: "image/jpeg", data: cropped.split(",")[1] } });

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.15, maxOutputTokens: 4096 } })
      });

      const data = await resp.json();
      if (data?.error) throw new Error(data.error.message);

      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try { setRoiResult(JSON.parse(clean)); } catch { setRoiResult({ candidates: [{ structure: "Не вдалося розпарсити", reasoning: clean, id_confidence: 0 }], id_confidence_overall: 0, anatomy: {}, what_to_check: "", uncertainty_note: "" }); }
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
      const parts = [];
      parts.push({ text: getPromptManual(ZONES[study?.zone]?.group || "joints", queryText) });

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.15, maxOutputTokens: 2000 } })
      });
      const data = await resp.json();
      if (data?.error) throw new Error(data.error.message);
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setRoiResult(JSON.parse(clean));
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
      const parts = [{ text: SYS_PROMPT }];
      parts.push({ text: `\nЗона: ${ZONES[study.zone].ua}\nСерії: ${usedSeqs.join(", ")}\nЗагальна кількість зрізів: ${all.length}\n` });

      // Clinical context
      const ctx = [];
      if (study.age) ctx.push(`Вік: ${study.age}`);
      if (study.complaints) ctx.push(`Скарги: ${study.complaints}`);
      if (study.mechanism) ctx.push(`Механізм травми / анамнез: ${study.mechanism}`);
      if (ctx.length) parts.push({ text: `\n--- КЛІНІЧНИЙ КОНТЕКСТ ---\n${ctx.join("\n")}\nВраховуй цей контекст при діагностиці.\n` });

      // Few-shot learning: include past confirmed corrections
      const pastCases = await getPastCorrections(study.zone);
      if (pastCases.length > 0) {
        parts.push({ text: `\n--- ПОПЕРЕДНІ ПІДТВЕРДЖЕНІ ВИПАДКИ (для контексту) ---\nЛікар підтвердив ${pastCases.length} попередніх випадків для цієї зони. Ось їх знахідки як приклади правильної інтерпретації:\n` });
        pastCases.forEach((c, i) => {
          parts.push({ text: `\nВипадок ${i + 1} (${c.date}):\nЗнахідки: ${JSON.stringify(c.findings.map(f => ({ structure: f.structure, description: f.description, severity: f.severity })))}\nВисновок: ${c.summary}\n` });
        });
        parts.push({ text: "\nВраховуй ці приклади при аналізі нового пацієнта. Звертай увагу на те, які знахідки лікар підтвердив як правильні.\n" });
      }

      const ne = Object.entries(vnotes).filter(([_, v]) => v.trim());
      if (ne.length) parts.push({ text: "\n--- НОТАТКИ ЛІКАРЯ ---\n" + ne.map(([k, v]) => `${k}: ${v.trim()}`).join("\n") });

      if (zrefs.length) {
        parts.push({ text: "\n--- РЕФЕРЕНСИ НОРМИ ---" });
        for (const r of zrefs.slice(0, 20)) parts.push({ inline_data: { mime_type: "image/jpeg", data: r.data.split(",")[1] } });
      }

      // Knowledge base rules — includes related detailed structures
      const zoneKb = collectZoneMaterials(kb, study.zone);
      if (zoneKb.length > 0) {
        parts.push({ text: "\n--- БАЗА ЗНАНЬ (діагностичні критерії для цієї зони) ---\n" + zoneKb.map(e => `[${e.title}]\n${e.text}`).join("\n\n") + "\n\nВраховуй ці діагностичні критерії при аналізі знімків.\n" });
      }

      setProg({ s: "send", p: 30 });

      // Send each series with its sequence label
      for (const seq of usedSeqs) {
        const imgs = study.series[seq];
        parts.push({ text: `\n--- СЕРІЯ ${seq} (${imgs.length} зрізів) ---` });
        for (const img of imgs) parts.push({ inline_data: { mime_type: "image/jpeg", data: img.data.split(",")[1] } });
      }
      parts.push({ text: "\nПроаналізуй ВСІ серії та зрізи. У findings вказуй серію та номери зрізів (наприклад slices: 'T2: 3-5, STIR: 12-14'). Порівняй з нормою, знайди ВСІ відхилення." });

      setProg({ s: "ai", p: 55 });
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.15, maxOutputTokens: 8192 } })
      });
      setProg({ s: "proc", p: 80 });
      const data = await resp.json();

      if (data?.error) throw new Error(data.error.message);

      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        const j = JSON.parse(clean);
        setStudy(p => ({ ...p, findings: j.findings || [], summary: j.summary, recommendation: j.recommendation, radio: j.radiopaedia_terms || [], status: "done" }));
      } catch {
        setStudy(p => ({ ...p, findings: [{ id: 1, structure: "Аналіз", description: clean, slices: "-", confidence_level: 50, severity: "mild" }], status: "done" }));
      }

      setProg(null); setScr("results");
      // Save full study to IndexedDB
      try {
        await dbPut("studies", String(study.id), { ...study, findings: study.findings, summary: study.summary, recommendation: study.recommendation, radio: study.radio });
      } catch {}
      const fc = (study.findings || []).length;
      const meta = { id: study.id, pn: study.patientName, z: study.zone, d: study.date, ic: all.length, fc };
      const upd = [meta, ...studies.slice(0, 24)];
      setStudies(upd);
      try { localStorage.setItem("mri-hist", JSON.stringify(upd)); } catch {}
    } catch (err) {
      setProg(null);
      setStudy(p => ({ ...p, findings: [{ id: 1, structure: "Помилка", description: err.message, slices: "-", confidence_level: 0, severity: "normal" }], status: "done" }));
      setScr("results");
    }
  };

  // ═══════════ PDF REPORT GENERATION ═══════════

  const sevLabel = (s) => ({ normal: "Норма", mild: "Легкий", moderate: "Помірний", severe: "Тяжкий" }[s] || s);
  const sevColor = (s) => ({ normal: "#22c55e", mild: "#eab308", moderate: "#f97316", severe: "#ef4444" }[s] || "#94a3b8");
  const sevEmoji = (s) => ({ normal: "🟢", mild: "🟡", moderate: "🟠", severe: "🔴" }[s] || "⚪");

  const generateReport = async (type) => {
    if (!study) return;
    flash("Генерація звіту...");
    const f = study.findings || [];
    const zone = ZONES[study.zone]?.ua || "";
    const pn = study.patientName || "Невідомий";
    const date = study.date || new Date().toLocaleDateString("uk-UA");

    const sevCounts = { normal: 0, mild: 0, moderate: 0, severe: 0 };
    f.forEach(x => { if (sevCounts[x.severity] !== undefined) sevCounts[x.severity]++; });
    const maxSev = f.length === 0 ? "normal" : (sevCounts.severe > 0 ? "severe" : sevCounts.moderate > 0 ? "moderate" : sevCounts.mild > 0 ? "mild" : "normal");
    const verdict = { normal: "Патології не виявлено", mild: "Незначні відхилення", moderate: "Помірні відхилення — потребує уваги", severe: "Значні відхилення — потребує лікування" }[maxSev];

    let html = "";

    if (type === "clinical") {
      html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;padding:32px;color:#1e293b">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0891b2;padding-bottom:16px;margin-bottom:24px">
          <div><h1 style="font-size:22px;margin:0;color:#0891b2">MRI Insight</h1><p style="font-size:11px;color:#64748b;margin:2px 0 0">Звіт МРТ дослідження</p></div>
          <div style="text-align:right"><p style="font-size:12px;color:#64748b;margin:0">Дата: ${date}</p></div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600;width:160px;font-size:13px">Пацієнт</td><td style="padding:6px 12px;font-size:13px">${pn}</td></tr>
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600;font-size:13px">Зона дослідження</td><td style="padding:6px 12px;font-size:13px">${zone}</td></tr>
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600;font-size:13px">Послідовності</td><td style="padding:6px 12px;font-size:13px">${Object.entries(study.series || {}).filter(([_,a]) => a.length > 0).map(([s,a]) => s + " (" + a.length + " зр.)").join(", ") || "—"}</td></tr>
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:600;font-size:13px">Кількість зрізів</td><td style="padding:6px 12px;font-size:13px">${totalCount()}</td></tr>
        </table>

        ${study.summary ? `<div style="background:#f0fdfa;border-left:4px solid #0891b2;padding:12px 16px;margin-bottom:16px;border-radius:0 8px 8px 0"><h3 style="font-size:14px;color:#0891b2;margin:0 0 6px">Висновок</h3><p style="font-size:13px;line-height:1.6;margin:0;color:#334155">${study.summary}</p></div>` : ""}

        ${study.recommendation ? `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin-bottom:16px;border-radius:0 8px 8px 0"><h3 style="font-size:14px;color:#3b82f6;margin:0 0 6px">Рекомендація</h3><p style="font-size:13px;line-height:1.6;margin:0;color:#334155">${study.recommendation}</p></div>` : ""}

        ${f.length > 0 ? `<h3 style="font-size:15px;color:#1e293b;margin:20px 0 12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px">Детальні знахідки (${f.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#0891b2;color:#fff">
            <th style="padding:8px;text-align:left;width:30px">№</th>
            <th style="padding:8px;text-align:left">Структура</th>
            <th style="padding:8px;text-align:left">Опис</th>
            <th style="padding:8px;text-align:center;width:70px">Впевненість</th>
            <th style="padding:8px;text-align:center;width:70px">Тяжкість</th>
            <th style="padding:8px;text-align:center;width:50px">Зрізи</th>
          </tr></thead>
          <tbody>${f.map((x, i) => `<tr style="border-bottom:1px solid #e2e8f0;${i % 2 === 0 ? "background:#f8fafc" : ""}">
            <td style="padding:6px 8px">${i + 1}</td>
            <td style="padding:6px 8px;font-weight:600">${x.structure}</td>
            <td style="padding:6px 8px;line-height:1.4">${x.description}</td>
            <td style="padding:6px 8px;text-align:center"><span style="background:${confColor(x.confidence_level || 50).bg};color:${confColor(x.confidence_level || 50).c};padding:2px 6px;border-radius:4px;font-weight:700;font-size:11px">${x.confidence_level ?? "?"}%</span></td>
            <td style="padding:6px 8px;text-align:center;color:${sevColor(x.severity)};font-weight:600">${sevLabel(x.severity)}</td>
            <td style="padding:6px 8px;text-align:center">${x.slices || "—"}</td>
          </tr>`).join("")}</tbody>
        </table>` : `<div style="text-align:center;padding:24px;background:#f0fdf4;border-radius:8px;margin:16px 0"><p style="font-size:16px;color:#22c55e;font-weight:600">✓ Патології не виявлено</p></div>`}

        ${f.some(x => x.pulse_sequence_hint) ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin-top:16px;border-radius:0 8px 8px 0"><h4 style="font-size:13px;color:#f59e0b;margin:0 0 4px">Рекомендації щодо послідовностей</h4>${f.filter(x => x.pulse_sequence_hint).map(x => `<p style="font-size:12px;color:#92400e;margin:3px 0">• ${x.pulse_sequence_hint}</p>`).join("")}</div>` : ""}

        <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0">
          <p style="font-size:10px;color:#94a3b8;line-height:1.5">⚕ Цей звіт створено за допомогою ІІ-аналізу та має виключно допоміжний характер. Він не замінює повноцінну клінічну інтерпретацію фахівця. Остаточний діагноз повинен ставити кваліфікований лікар на підставі повної клінічної картини.</p>
          <p style="font-size:9px;color:#cbd5e1;margin-top:6px">MRI Insight · ${date} · Згенеровано автоматично</p>
        </div>
      </div>`;
    } else {
      // TRAINER REPORT
      const barMax = Math.max(...Object.values(sevCounts), 1);
      html = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;color:#1e293b">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #8b5cf6;padding-bottom:16px;margin-bottom:24px">
          <div><h1 style="font-size:22px;margin:0;color:#8b5cf6">MRI Insight</h1><p style="font-size:11px;color:#64748b;margin:2px 0 0">Звіт для тренера</p></div>
          <div style="text-align:right"><p style="font-size:12px;color:#64748b;margin:0">${date}</p></div>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:24px">
          <div style="flex:1"><p style="font-size:11px;color:#64748b;margin:0 0 2px">Спортсмен</p><p style="font-size:16px;font-weight:700;margin:0">${pn}</p></div>
          <div><p style="font-size:11px;color:#64748b;margin:0 0 2px">Зона</p><p style="font-size:16px;font-weight:700;margin:0">${zone}</p></div>
        </div>

        <div style="background:${sevColor(maxSev)}15;border:2px solid ${sevColor(maxSev)};border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <p style="font-size:36px;margin:0">${sevEmoji(maxSev)}</p>
          <p style="font-size:20px;font-weight:700;color:${sevColor(maxSev)};margin:8px 0 4px">${verdict}</p>
          <p style="font-size:13px;color:#64748b;margin:0">${f.length === 0 ? "Відхилень не знайдено" : `Знайдено ${f.length} знахідок`}</p>
        </div>

        ${f.length > 0 ? `<h3 style="font-size:14px;margin:0 0 12px">Розподіл за тяжкістю</h3>
        <div style="margin-bottom:24px">
          ${[["severe", "Тяжкі"], ["moderate", "Помірні"], ["mild", "Легкі"], ["normal", "Норма"]].map(([k, label]) =>
            `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;width:70px;color:#64748b">${label}</span>
              <div style="flex:1;height:20px;background:#f1f5f9;border-radius:4px;overflow:hidden">
                <div style="width:${(sevCounts[k] / barMax) * 100}%;height:100%;background:${sevColor(k)};border-radius:4px;min-width:${sevCounts[k] > 0 ? '20px' : '0'}"></div>
              </div>
              <span style="font-size:13px;font-weight:700;width:24px;text-align:right">${sevCounts[k]}</span>
            </div>`).join("")}
        </div>` : ""}

        ${study.summary ? `<div style="background:#f8fafc;border-radius:8px;padding:14px 16px;margin-bottom:16px"><h3 style="font-size:13px;color:#8b5cf6;margin:0 0 6px">Що показало МРТ</h3><p style="font-size:13px;line-height:1.6;margin:0;color:#475569">${study.summary}</p></div>` : ""}

        ${f.length > 0 ? `<h3 style="font-size:14px;margin:0 0 10px">Основні знахідки</h3>
        ${f.map(x => `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding:10px 12px;background:#f8fafc;border-radius:8px;border-left:3px solid ${sevColor(x.severity)}">
          <span style="font-size:16px">${sevEmoji(x.severity)}</span>
          <div><p style="font-size:13px;font-weight:600;margin:0">${x.structure}</p><p style="font-size:12px;color:#64748b;margin:3px 0 0;line-height:1.4">${x.description}</p></div>
        </div>`).join("")}` : ""}

        ${study.recommendation ? `<div style="background:#f0fdfa;border-radius:8px;padding:14px 16px;margin-top:16px"><h3 style="font-size:13px;color:#0891b2;margin:0 0 6px">Рекомендація</h3><p style="font-size:13px;line-height:1.6;margin:0;color:#475569">${study.recommendation}</p></div>` : ""}

        <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0">
          <p style="font-size:10px;color:#94a3b8;line-height:1.5">⚕ Цей звіт створено ІІ-системою MRI Insight і має допоміжний характер. Рішення про повернення до тренувань приймає лікар.</p>
          <p style="font-size:9px;color:#cbd5e1;margin-top:6px">MRI Insight · ${date}</p>
        </div>
      </div>`;
    }

    // Generate — open in new window (reliable, user can Save as PDF or Print)
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>МРТ Звіт — ${pn}</title><style>body{margin:0;padding:20px}@media print{body{padding:10px}}</style></head><body>${html}</body></html>`);
      w.document.close();
      flash("Звіт відкрито → Ctrl+P для збереження у PDF");
    } else {
      flash("Дозвольте спливаючі вікна для цього сайту");
    }
  };

  // ═══════════ SCREENS ═══════════

  // Tabler icon helper
  const TI = ({ name, size = 14, color }) => <i className={`ti ${name}`} style={{ fontSize: size, color, lineHeight: 1 }} aria-hidden="true" />;

  // Reusable grouped zone selector with collapsible submenus for muscles/ligaments
  // renderZone(zoneKey, zoneObj) => JSX for a single zone button
  const ZoneGroups = ({ renderZone, countFn }) => (
    <>
      {Object.entries(ZONE_GROUPS).map(([gk, gv]) => {
        const zonesInGroup = Object.entries(ZONES).filter(([_, z]) => z.group === gk);
        const hasSubs = zonesInGroup.some(([_, z]) => z.sub);

        if (!hasSubs) {
          return (
            <div key={gk} style={{ marginBottom: 10 }}>
              <p style={P.grpLabel}><TI name={gv.icon} size={13} color="#8b919c" /> {gv.label}</p>
              <div style={P.ztRow}>{zonesInGroup.map(([k, v]) => renderZone(k, v))}</div>
            </div>
          );
        }

        // Group with subdivisions — render collapsible submenus
        const subsMap = {};
        zonesInGroup.forEach(([k, v]) => { (subsMap[v.sub] = subsMap[v.sub] || []).push([k, v]); });
        return (
          <div key={gk} style={{ marginBottom: 10 }}>
            <p style={P.grpLabel}><TI name={gv.icon} size={13} color="#8b919c" /> {gv.label}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {Object.entries(subsMap).map(([subKey, subZones]) => {
                const open = expandedSubs[subKey];
                const subCount = countFn ? subZones.reduce((s, [k]) => s + countFn(k), 0) : 0;
                return (
                  <div key={subKey} style={{ background: "#0f1217", border: "0.5px solid rgba(255,255,255,.05)", borderRadius: 6, overflow: "hidden" }}>
                    <div onClick={() => setExpandedSubs(p => ({ ...p, [subKey]: !p[subKey] }))}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", cursor: "pointer" }}>
                      <span style={{ fontSize: 11, color: "#c4c9d0", fontWeight: 500 }}>{SUBGROUPS[subKey]}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {subCount > 0 && <span style={P.ztB}>{subCount}</span>}
                        <TI name={open ? "ti-chevron-down" : "ti-chevron-right"} size={14} color="#5f6672" />
                      </span>
                    </div>
                    {open && <div style={{ ...P.ztRow, padding: "0 10px 8px" }}>{subZones.map(([k, v]) => renderZone(k, v))}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );


  
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

  const onWindowStart = (side, e) => {
    e.preventDefault();
    const orig = side === "L" ? wlL : wlR;
    setWindowing({ side, startX: e.clientX, startY: e.clientY, origB: orig.b, origC: orig.c });
  };
  
  const onWindowMove = (e) => {
    if (!windowing) return;
    const deltaX = e.clientX - windowing.startX;
    const deltaY = e.clientY - windowing.startY;
    const newB = Math.max(10, Math.min(400, windowing.origB - deltaY * 0.7));
    const newC = Math.max(10, Math.min(400, windowing.origC + deltaX * 0.7));
    if (windowing.side === "L") setWlL({ b: newB, c: newC });
    else setWlR({ b: newB, c: newC });
  };
  
  const onWindowEnd = () => setWindowing(null);


  
  const generateAiReport = async () => {
    if (!apiKey) { flash("Введіть ваш API ключ"); return; }
    if (!study) return;
    setReportLoading(true);
    setShowReport(true);
    setReportText("");
    
    try {
      const notes = Object.entries(vnotes)
        .filter(([k, v]) => k.startsWith(study.id) || true) // We just take all non-empty notes. To be safe, maybe we should filter by study ID if we prefixed them. Wait, note keys are `seriesKey()-sliceIdx`.
        .filter(([k, v]) => v.trim())
        .map(([k, v]) => `- Зріз ${k}: ${v.trim()}`)
        .join("\n");
        
      const prompt = `Ти — головний лікар-рентгенолог. Твоє завдання — написати офіційний протокол МРТ-дослідження (українською мовою).
Зона дослідження: ${ZONES[study.zone]?.ua || "Невідома зона"}.
Пацієнт: ${study.patientName || "Не вказано"}.

Ось чорнові нотатки та знахідки лікаря, зроблені під час перегляду знімків:
${notes ? notes : "Нотаток немає. Опиши абсолютну норму для цієї анатомічної зони."}

Вимоги до протоколу:
1. Офіційний медичний стиль.
2. Розділ "ОПИС" (структурований по всіх основних анатомічних компонентах зони). Якщо в нотатках є патологія — розгорнуто опиши її. Якщо про компонент нічого не сказано в нотатках — опиши його як норму.
3. Розділ "ВИСНОВОК" (короткий підсумок виявлених патологій або констатація норми).
Не пиши жодних вступних слів, видай ТІЛЬКИ готовий текст медичного протоколу.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25 } })
      });
      const data = await resp.json();
      if (data?.error) throw new Error(data.error.message);
      let resText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      setReportText(resText.trim());
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
    recording, setRecording,
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
    measurements, setMeasurements,
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
