import React, { useEffect } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { ZONES, parseSeriesKey } from "../constants/anatomy.js";
import { collectZoneMaterials } from "../utils/helpers.js";
import { calculateLocalizerLine } from "../utils/geometry.js";
import { 
  ArrowLeft, Search, FileText, Crosshair, Star, ChevronLeft, ChevronRight, 
  Mic, MicOff, Trash2, Link, Ruler, TriangleRight, Circle, Sun, Brain, AlertCircle, Eye, X, BookOpen,
  Calendar, History, Layers
} from "lucide-react";
import { dbGet } from "../services/db.js";

export default function SplitScreen() {
  const context = React.useContext(AppContext);
  const { 
    study, setStudy, setScr, prevScr, curImgs, seriesKey, seriesCounts, 
    splitIdx, setSplitIdx, zoomL, setZoomL, zoomR, setZoomR, 
    wlL, setWlL, wlR, setWlR, panning, setPanning, 
    roi, setRoi, roiDrawing, setRoiDrawing, roiStart, setRoiStart, 
    roiResult, setRoiResult, roiLoading, setRoiLoading, 
    toolMode, setToolMode, measurements, setMeasurements, 
    activeMeasure, setActiveMeasure, activeArea, setActiveArea, 
    activeAngle, setActiveAngle, angleMousePos, setAngleMousePos, 
    vnotes, setVnotes, recording, startVoice, stopVoice, 
    manualQuery, setManualQuery, askManualAnatomy, generateAiReport, 
    aiMarkers, setAiMarkers, aiScanning, setAiScanning, 
    rightMode, setRightMode, compareSeriesKey, setCompareSeriesKey, 
    compareIdx, setCompareIdx, syncScroll, setSyncScroll, 
    refSource, setRefSource, refIdx, setRefIdx, refs, atlas, kb, 
    roiImgRef, flash, sortSlices, analyzeRoi, 
    onViewerWheel, resetZoom, onViewerPanStart, onViewerPanMove, onViewerPanEnd, 
    onWindowStart, onWindowMove, onWindowEnd, toolMouseDown, toolMouseMove, toolMouseUp, 
    apiKey, aiModel, studies
  } = context;

      const im = curImgs();
    const noteKey = `${seriesKey()}-${splitIdx}`;
    // Reference source: refs / atlas / kb (text) — includes related structures
    const refImgs = refSource === "refs" ? collectZoneMaterials(refs, study?.zone)
      : refSource === "atlas" ? collectZoneMaterials(atlas, study?.zone) : [];
    const kbEntries = collectZoneMaterials(kb, study?.zone);
    
    
    const scanSeries = async () => {
      if (!apiKey) return flash("Введіть API ключ!");
      if (im.length === 0) return;
      setAiScanning(true);
      setAiMarkers({});
      
      try {
        const parts = [
          { text: `Ти — ШІ-асистент рентгенолога. Проаналізуй цю МРТ серію (Зона: ${ZONES[study.zone]?.ua || "Невідома"}). 
Я передаю тобі ${im.length} зрізів по порядку. Твоє завдання: знайти зрізи з ознаками патології.
Поверни ТІЛЬКИ валідний JSON-масив у форматі: [{"slice": 3, "finding": "Опис проблеми"}, ...]. Якщо патологій немає, поверни []. Важливо: відлік зрізів починається з 0, ігноруй артефакти руху, шукай реальні патології.` }
        ];
        
        for (let i = 0; i < im.length; i++) {
          parts.push({ text: `Зріз ${i}:` });
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: im[i].data.split(",")[1]
            }
          });
        }

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${apiKey}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1 } })
        });
        
        const data = await resp.json();
        if (data?.error) throw new Error(data.error.message);
        let resText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        resText = resText.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(resText);
        
        const markers = {};
        parsed.forEach(p => { if (p.slice !== undefined) markers[p.slice] = p.finding; });
        setAiMarkers(markers);
        flash(`Сканування завершено: знайдено ${Object.keys(markers).length} підозр.`);
      } catch (e) {
        console.error("Scan error:", e);
        flash("Помилка сканування: " + e.message);
      } finally {
        setAiScanning(false);
      }
    };

    // State for cross-study comparison
    const [compareStudyId, setCompareStudyId] = React.useState(null);
    const [compareStudyData, setCompareStudyData] = React.useState(null);
    const [loadingCompareStudy, setLoadingCompareStudy] = React.useState(false);

    // Load another study when compareStudyId changes
    useEffect(() => {
      if (!compareStudyId || compareStudyId === study?.id) {
        setCompareStudyData(null);
        return;
      }
      let isMounted = true;
      (async () => {
        setLoadingCompareStudy(true);
        try {
          const loaded = await dbGet("studies", String(compareStudyId));
          if (isMounted && loaded) {
            setCompareStudyData(loaded);
            const keys = Object.keys(loaded.series || {});
            if (keys.length > 0) {
              setCompareSeriesKey(keys[0]);
              setCompareIdx(0);
            }
          }
        } catch (err) {
          console.error("Error loading comparison study:", err);
          flash("Помилка завантаження дослідження для порівняння");
        } finally {
          if (isMounted) setLoadingCompareStudy(false);
        }
      })();
      return () => { isMounted = false; };
    }, [compareStudyId, study?.id]);

    // Determine which study's series are used on the right
    const activeRightStudy = compareStudyData || study;
    const rightSeriesObj = activeRightStudy?.series || {};
    const compImgs = (rightMode === "compare" && compareSeriesKey && sortSlices(rightSeriesObj[compareSeriesKey])) || [];

    const navSlice = (dir) => { 
      setSplitIdx(p => {
        const nextL = Math.max(0, Math.min(im.length - 1, p + dir));
        if (syncScroll && compImgs.length > 0) {
          const pct = nextL / Math.max(1, im.length - 1);
          setCompareIdx(Math.round(pct * (compImgs.length - 1)));
        }
        return nextL;
      }); 
      setRoi(null); setRoiResult(null); setMeasurements([]); 
    };
    const navCompare = (dir) => {
      setCompareIdx(p => {
        const nextR = Math.max(0, Math.min(compImgs.length - 1, p + dir));
        if (syncScroll && im.length > 0) {
          const pct = nextR / Math.max(1, compImgs.length - 1);
          setSplitIdx(Math.round(pct * (im.length - 1)));
          setRoi(null); setRoiResult(null); setMeasurements([]); 
        }
        return nextR;
      });
    };

    // State for localizer (cross-reference scout line)
    const [showLocalizer, setShowLocalizer] = React.useState(true);

    // Calculate scout / localizer lines
    const leftSlice = im[splitIdx];
    const rightSlice = compImgs[compareIdx];
    const leftPlane = study?.activePlane;
    const rightPlane = compareSeriesKey ? parseSeriesKey(compareSeriesKey, activeRightStudy?.zone).plane : null;

    // Line to draw on Right viewer showing position of active Left slice
    const localizerOnRight = (showLocalizer && rightMode === "compare" && leftSlice && rightSlice) 
      ? calculateLocalizerLine(rightSlice, leftSlice, rightPlane, leftPlane, splitIdx, im.length)
      : null;

    // Line to draw on Left viewer showing position of active Right slice
    const localizerOnLeft = (showLocalizer && rightMode === "compare" && leftSlice && rightSlice)
      ? calculateLocalizerLine(leftSlice, rightSlice, leftPlane, rightPlane, compareIdx, compImgs.length)
      : null;

    const navRef = (dir) => setRefIdx(p => Math.max(0, Math.min(refImgs.length - 1, p + dir)));

    // Key Frames (★) toggle for current slice
    const isCurrentKeyFrame = (study?.keyImages || []).some(
      k => k.seq === study?.activeSeq && k.plane === study?.activePlane && (k.sliceIdx === splitIdx + 1)
    );

    const toggleKeyImage = () => {
      if (!study || !im[splitIdx]) return;
      const curSliceNum = splitIdx + 1;
      const existing = (study.keyImages || []).find(
        k => k.seq === study.activeSeq && k.plane === study.activePlane && k.sliceIdx === curSliceNum
      );

      let updatedKeyImages;
      if (existing) {
        updatedKeyImages = study.keyImages.filter(k => k !== existing);
        flash("Зріз видалено з ключових кадрів");
      } else {
        const newKey = {
          id: Date.now(),
          sliceIdx: curSliceNum,
          seq: study.activeSeq,
          plane: study.activePlane,
          zone: study.zone,
          data: im[splitIdx].data,
          note: vnotes[noteKey] || ""
        };
        updatedKeyImages = [...(study.keyImages || []), newKey];
        flash("★ Зріз додано до ключових кадрів!");
      }

      setStudy(p => ({ ...p, keyImages: updatedKeyImages }));
    };

    // Keyboard Hotkeys
    useEffect(() => {
      const handleKeyDown = (e) => {
        // Ignore if focus is in an input or textarea
        if (["INPUT", "TEXTAREA"].includes(e.target.tagName) || e.target.isContentEditable) {
          return;
        }

        const key = e.key;
        const code = e.code;

        // Navigation
        if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") {
          e.preventDefault();
          navSlice(-1);
        } else if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") {
          e.preventDefault();
          navSlice(1);
        } 
        // Tool modes: 1 -> ROI, 2 -> Line, 3 -> Angle, 4 -> Area
        else if (key === "1") {
          e.preventDefault();
          setToolMode("roi");
          setMeasurements([]);
          setActiveMeasure(null);
        } else if (key === "2") {
          e.preventDefault();
          setToolMode("measure_line");
          setRoi(null);
          setRoiResult(null);
        } else if (key === "3") {
          e.preventDefault();
          setToolMode("measure_angle");
          setRoi(null);
          setRoiResult(null);
          setActiveAngle([]);
          setAngleMousePos(null);
        } else if (key === "4") {
          e.preventDefault();
          setToolMode("measure_area");
          setRoi(null);
          setRoiResult(null);
        }
        // W / Ц -> Window / Level (Contrast)
        else if (code === "KeyW" || key === "w" || key === "W" || key === "ц" || key === "Ц") {
          e.preventDefault();
          setToolMode("window");
          setRoi(null);
          setRoiResult(null);
          setMeasurements([]);
        }
        // S / І / Ы -> Key Frame toggle
        else if (code === "KeyS" || key === "s" || key === "S" || key === "і" || key === "І" || key === "ы" || key === "Ы") {
          e.preventDefault();
          toggleKeyImage();
        }
        // Space -> Dictation / Voice note
        else if (code === "Space") {
          e.preventDefault();
          if (recording === noteKey) {
            stopVoice();
          } else {
            startVoice(noteKey);
          }
        }
        // Escape -> Reset active measurements / ROI
        else if (key === "Escape") {
          e.preventDefault();
          setRoi(null);
          setRoiResult(null);
          setActiveMeasure(null);
          setActiveArea(null);
          setActiveAngle([]);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [im, splitIdx, noteKey, recording, study, syncScroll, compImgs]);

    return (
      <div style={{ height: "100vh", maxHeight: "100vh", boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden", padding: "6px 12px 6px", color: "#e8eaed", fontFamily: "'IBM Plex Sans',sans-serif" }}
        onMouseMove={(e) => { onViewerPanMove(e); onWindowMove(e); }} onMouseUp={() => { onViewerPanEnd(); onWindowEnd(); }} onMouseLeave={() => { onViewerPanEnd(); onWindowEnd(); }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => { setScr(prevScr); setRoi(null); setRoiResult(null); resetZoom("L"); resetZoom("R"); }} style={P.bk}><ArrowLeft size={16} /> Назад</button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#e8eaed" }}>Роздільний перегляд</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 16 }}>
            <Search size={14} color="#8b919c" />
            <input type="text" value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter") askManualAnatomy(manualQuery); }} placeholder="Введіть назву структури..." style={{ ...P.inp, padding: "4px 8px", fontSize: 11, width: 220, background: "#1a1d24" }} />
            <button onClick={() => askManualAnatomy(manualQuery)} disabled={roiLoading || !manualQuery} style={{ ...P.sm, background: "#1d6ea8", color: "#fff", border: "none" }}>Знайти</button>
          </div>
          <span style={{ fontSize: 9, color: "#5f6672", fontFamily: "'JetBrains Mono',monospace" }}>колесо / стрілки — зрізи · 1-4 — вимірювання · W — контраст · S — ★ · Пробіл — голос</span>
          <button onClick={generateAiReport} style={{ ...P.pri, padding: "5px 12px", fontSize: 11, background: "#8b5cf6", border: "none", marginLeft: "auto" }}><FileText size={14} style={{ marginRight: 6 }}/> Сформувати протокол</button>
          <div style={{ display: "flex", gap: 4, marginLeft: 16, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(seriesCounts()).map(([k, cnt]) => {
              const { zone: sZone, seq, plane } = parseSeriesKey(k, study?.zone);
              const isMultiZone = (study?.zones && study.zones.length > 1);
              const isSelected = (k === seriesKey() || k === study?.activeSeriesKey);
              const zoneTag = isMultiZone && sZone && ZONES[sZone] ? `[${ZONES[sZone].short}] ` : "";

              return (
                <button 
                  key={k} 
                  onClick={() => { 
                    setStudy(p => ({ 
                      ...p, 
                      zone: sZone || p.zone, 
                      activeSeq: seq, 
                      activePlane: plane,
                      activeSeriesKey: k 
                    })); 
                    setSplitIdx(0); 
                    setRoi(null); 
                    setRoiResult(null); 
                    resetZoom("L"); 
                    setAiMarkers({}); 
                  }}
                  style={{ 
                    ...(isSelected ? P.sqOn : P.sq), 
                    padding: "4px 8px", 
                    fontSize: 10,
                    fontWeight: isSelected ? 600 : 400 
                  }}
                >
                  {zoneTag}{seq} {plane} ({cnt})
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* PATIENT with ROI + zoom */}
          <div style={{ background: "#0f1217", border: "0.5px solid rgba(255,255,255,.06)", borderRadius: 8, padding: 4, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 3px" }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: "#8b919c", textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 6 }}>
                <Crosshair size={10} /> Пацієнт · {study?.zones?.length > 1 && study.zone && ZONES[study.zone] ? `[${ZONES[study.zone].short || ZONES[study.zone].ua}] ` : ""}{study?.activeSeq} {study?.activePlane}
                <button 
                  onClick={toggleKeyImage} 
                  style={{ 
                    background: isCurrentKeyFrame ? "rgba(224,169,59,0.2)" : "transparent", 
                    border: isCurrentKeyFrame ? "1px solid #e0a93b" : "1px solid rgba(255,255,255,0.15)", 
                    color: isCurrentKeyFrame ? "#e0a93b" : "#8b919c", 
                    borderRadius: 4, 
                    padding: "1px 5px", 
                    cursor: "pointer", 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 3, 
                    fontSize: 10 
                  }} 
                  title="Позначити зріз як ключовий кадр патології (S)"
                >
                  <Star size={11} fill={isCurrentKeyFrame ? "#e0a93b" : "none"} />
                  {isCurrentKeyFrame ? "Ключовий ★" : "+ Кадр"}
                </button>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {zoomL.scale > 1 && <button onClick={() => resetZoom("L")} style={{ ...P.sm, padding: "2px 6px", fontSize: 9 }}>{zoomL.scale.toFixed(1)}× ✕</button>}
                <span style={{ fontSize: 10, color: "#5f6672", fontFamily: "'JetBrains Mono',monospace" }}>{im.length > 0 ? `${splitIdx + 1}/${im.length}` : "—"}</span>
              </span>
            </div>
            <div ref={roiImgRef}
              onWheel={(e) => onViewerWheel("L", e, navSlice)}
              style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: zoomL.scale > 1 ? (panning ? "grabbing" : "grab") : "crosshair", userSelect: "none" }}
              onContextMenu={(e)=>e.preventDefault()} onMouseDown={(e) => { if (e.button === 2) { onWindowStart("L", e); return; } if (zoomL.scale > 1) onViewerPanStart("L", e); else { if (toolMode.startsWith("measure") || toolMode === "roi") toolMouseDown(e); else onWindowStart("L", e); } }}
              onMouseMove={(e) => { if (zoomL.scale <= 1) { if (toolMode.startsWith("measure") || toolMode === "roi") toolMouseMove(e); } }}
              onMouseUp={() => { if (zoomL.scale <= 1) { if (toolMode.startsWith("measure") || toolMode === "roi") toolMouseUp(); } }}>
              {im[splitIdx] ? (
                <img src={im[splitIdx].data} alt="" draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 4, pointerEvents: "none", filter: `brightness(${wlL.b}%) contrast(${wlL.c}%)`, transform: `translate(${zoomL.x}px, ${zoomL.y}px) scale(${zoomL.scale})`, transformOrigin: "center", transition: panning ? "none" : "transform .1s" }} />
              ) : <span style={{ color: "#3a3f47" }}>—</span>}
              {roi && zoomL.scale <= 1 && (
                <div style={{ position: "absolute", left: `${roi.x * 100}%`, top: `${roi.y * 100}%`, width: `${roi.w * 100}%`, height: `${roi.h * 100}%`, border: "2px solid #e0a93b", background: "rgba(224,169,59,.12)", borderRadius: 3, pointerEvents: "none", boxShadow: "0 0 0 9999px rgba(0,0,0,.35)" }} />
              )}
              {/* Localizer & Measurements Layer */}
              {zoomL.scale <= 1 && (measurements.length > 0 || activeMeasure || activeArea || activeAngle.length > 0 || localizerOnLeft) && (
                <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}>
                  {/* Scout / Localizer Line (showing Right slice position on Left viewer) */}
                  {localizerOnLeft && (
                    <g>
                      <line 
                        x1={localizerOnLeft.x1 * 1000} 
                        y1={localizerOnLeft.y1 * 1000} 
                        x2={localizerOnLeft.x2 * 1000} 
                        y2={localizerOnLeft.y2 * 1000} 
                        stroke="#facc15" 
                        strokeWidth="1.8" 
                        vectorEffect="non-scaling-stroke" 
                        strokeDasharray="8 4"
                        style={{ filter: "drop-shadow(0px 0px 3px rgba(0,0,0,0.9))" }}
                      />
                      <circle cx={localizerOnLeft.x1 * 1000} cy={localizerOnLeft.y1 * 1000} r="3" fill="#facc15" />
                      <circle cx={localizerOnLeft.x2 * 1000} cy={localizerOnLeft.y2 * 1000} r="3" fill="#facc15" />
                      <text 
                        x={((localizerOnLeft.x1 + localizerOnLeft.x2) / 2) * 1000} 
                        y={((localizerOnLeft.y1 + localizerOnLeft.y2) / 2) * 1000} 
                        fill="#facc15" 
                        fontSize="20" 
                        fontWeight="700" 
                        fontFamily="'JetBrains Mono',monospace"
                        style={{ textShadow: "1px 1px 3px #000, -1px -1px 3px #000" }} 
                        dx="6" 
                        dy="-6"
                      >
                        {rightPlane ? `${rightPlane.slice(0, 3)}: ${compareIdx + 1}` : `${compareIdx + 1}`}
                      </text>
                    </g>
                  )}

                  {measurements.map((m, i) => {
                    if (m.type === "line") {
                      return (
                        <g key={i}>
                          <line x1={m.startX * 1000} y1={m.startY * 1000} x2={m.endX * 1000} y2={m.endY * 1000} stroke="#e0a93b" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                          <circle cx={m.startX * 1000} cy={m.startY * 1000} r="3" fill="#e0a93b" />
                          <circle cx={m.endX * 1000} cy={m.endY * 1000} r="3" fill="#e0a93b" />
                          <text x={(m.startX + m.endX) * 500} y={(m.startY + m.endY) * 500} fill="#ffffff" fontSize="24" fontWeight="600" style={{ textShadow: "1px 1px 3px #000, -1px -1px 3px #000" }} dx="8" dy="-8">
                            {m.mm ? `${m.mm.toFixed(1)} mm` : `${Math.round(m.px)} px`}
                          </text>
                        </g>
                      );
                    } else if (m.type === "area") {
                      const cx = (m.startX + m.endX) * 500;
                      const cy = (m.startY + m.endY) * 500;
                      const rx = Math.abs(m.endX - m.startX) * 500;
                      const ry = Math.abs(m.endY - m.startY) * 500;
                      return (
                        <g key={i}>
                          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="#4aa3df" strokeWidth="1.5" vectorEffect="non-scaling-stroke" fill="rgba(74,163,223,0.12)"/>
                          <text x={cx} y={cy} fill="#ffffff" fontSize="24" fontWeight="600" style={{ textShadow: "1px 1px 3px #000, -1px -1px 3px #000" }} textAnchor="middle" dominantBaseline="middle">
                            {m.areaMm2 ? `${Math.round(m.areaMm2)} mm²` : '?'}
                          </text>
                        </g>
                      );
                    } else if (m.type === "angle") {
                      return (
                        <g key={i}>
                          <polyline points={`${m.pts[1].x * 1000},${m.pts[1].y * 1000} ${m.pts[0].x * 1000},${m.pts[0].y * 1000} ${m.pts[2].x * 1000},${m.pts[2].y * 1000}`} stroke="#e24b4a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx={m.pts[0].x * 1000} cy={m.pts[0].y * 1000} r="3" fill="#e24b4a" />
                          <circle cx={m.pts[1].x * 1000} cy={m.pts[1].y * 1000} r="3" fill="#e24b4a" />
                          <circle cx={m.pts[2].x * 1000} cy={m.pts[2].y * 1000} r="3" fill="#e24b4a" />
                          <text x={m.pts[0].x * 1000} y={m.pts[0].y * 1000} fill="#ffffff" fontSize="24" fontWeight="600" style={{ textShadow: "1px 1px 3px #000, -1px -1px 3px #000" }} dx="12" dy="12">
                            {m.deg.toFixed(1)}°
                          </text>
                        </g>
                      );
                    }
                    return null;
                  })}

                  {/* Active Drawings */}
                  {activeMeasure && (
                    <line x1={activeMeasure.startX * 1000} y1={activeMeasure.startY * 1000} x2={activeMeasure.endX * 1000} y2={activeMeasure.endY * 1000} stroke="rgba(224,169,59,.8)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />
                  )}
                  {activeArea && (() => {
                    const cx = (activeArea.startX + activeArea.endX) * 500;
                    const cy = (activeArea.startY + activeArea.endY) * 500;
                    const rx = Math.abs(activeArea.endX - activeArea.startX) * 500;
                    const ry = Math.abs(activeArea.endY - activeArea.startY) * 500;
                    return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="rgba(74,163,223,.8)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" fill="rgba(74,163,223,0.08)" strokeDasharray="6 4"/>
                  })()}
                  {activeAngle.length > 0 && angleMousePos && (
                    <g>
                      {activeAngle.length === 1 && <line x1={activeAngle[0].x * 1000} y1={activeAngle[0].y * 1000} x2={angleMousePos.x * 1000} y2={angleMousePos.y * 1000} stroke="rgba(226,75,74,.8)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" />}
                      {activeAngle.length === 2 && (
                        <polyline points={`${activeAngle[1].x * 1000},${activeAngle[1].y * 1000} ${activeAngle[0].x * 1000},${activeAngle[0].y * 1000} ${angleMousePos.x * 1000},${angleMousePos.y * 1000}`} stroke="rgba(226,75,74,.8)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" fill="none"/>
                      )}
                    </g>
                  )}
                </svg>
              )}

            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "4px 0", flexWrap: "wrap" }}>
              
              <div style={{ display: "flex", gap: 2, marginRight: 8, background: "#1a1d24", borderRadius: 6, padding: 2 }}>
                <button onClick={() => { setToolMode("roi"); setMeasurements([]); setActiveMeasure(null); }} style={{ ...P.sm, padding: "4px 8px", background: toolMode === "roi" ? "rgba(74,163,223,.18)" : "transparent", color: toolMode === "roi" ? "#4aa3df" : "#8b919c", border: "none" }} title="Виділення (ROI)"><Crosshair size={12} /></button>
                
                <button onClick={() => { setToolMode("measure_line"); setRoi(null); setRoiResult(null); }} style={{ ...P.sm, padding: "4px 8px", background: toolMode === "measure_line" ? "rgba(224,169,59,.18)" : "transparent", color: toolMode === "measure_line" ? "#e0a93b" : "#8b919c", border: "none" }} title="Лінійка (Відстань)"><Ruler size={12} /></button>
                <button onClick={() => { setToolMode("measure_angle"); setRoi(null); setRoiResult(null); setActiveAngle([]); setAngleMousePos(null); }} style={{ ...P.sm, padding: "4px 8px", background: toolMode === "measure_angle" ? "rgba(226,75,74,.18)" : "transparent", color: toolMode === "measure_angle" ? "#e24b4a" : "#8b919c", border: "none" }} title="Кут (3 точки)"><TriangleRight size={12} /></button>
                <button onClick={() => { setToolMode("measure_area"); setRoi(null); setRoiResult(null); }} style={{ ...P.sm, padding: "4px 8px", background: toolMode === "measure_area" ? "rgba(74,163,223,.18)" : "transparent", color: toolMode === "measure_area" ? "#4aa3df" : "#8b919c", border: "none" }} title="Площа (Еліпс)"><Circle size={12} /></button>

                <button onClick={() => { setToolMode("window"); setRoi(null); setRoiResult(null); setMeasurements([]); }} style={{ ...P.sm, padding: "4px 8px", background: toolMode === "window" ? "rgba(74,163,223,.18)" : "transparent", color: toolMode === "window" ? "#4aa3df" : "#8b919c", border: "none" }} title="Контраст (W/L)"><Sun size={12} /></button>
                
                {/* Localizer (Scout lines) Toggle */}
                <button 
                  onClick={() => setShowLocalizer(!showLocalizer)} 
                  style={{ 
                    ...P.sm, 
                    padding: "4px 8px", 
                    background: showLocalizer ? "rgba(250,204,21,.18)" : "transparent", 
                    color: showLocalizer ? "#facc15" : "#8b919c", 
                    border: "none" 
                  }} 
                  title="Лінії зрізів (Локалізатор / Scout line)"
                >
                  <Layers size={12} />
                </button>
              </div>
              <button onClick={scanSeries} disabled={aiScanning || im.length===0} style={{ ...P.sm, padding: "4px 8px", background: "rgba(139,92,246,.18)", color: "#8b5cf6", border: "none", marginRight: 8 }}>
                {aiScanning ? "Сканування..." : "✨ AI Скан"}
              </button>
              <button disabled={splitIdx <= 0} onClick={() => navSlice(-1)} style={P.nv}><ChevronLeft size={14} /></button>
              
              {/* Timeline Bar */}
              <div style={{ width: 100, height: 4, background: "#1a1d24", position: "relative", borderRadius: 2, margin: "0 6px" }}>
                {Object.keys(aiMarkers).map(idx => (
                   <div key={idx} style={{ position: "absolute", left: `${(Number(idx) / Math.max(1, im.length - 1)) * 100}%`, top: -2, width: 8, height: 8, borderRadius: "50%", background: "#e24b4a", cursor: "pointer", transform: "translateX(-50%)" }} onClick={() => { setSplitIdx(Number(idx)); setMeasurements([]); setRoi(null); }} title={aiMarkers[idx]} />
                ))}
                <div style={{ position: "absolute", left: `${(splitIdx / Math.max(1, im.length - 1)) * 100}%`, top: -1, width: 6, height: 6, borderRadius: "50%", background: "#4aa3df", transform: "translateX(-50%)", pointerEvents: "none", transition: "left 0.1s" }} />
              </div>

              <span style={{ fontSize: 10, color: "#8b919c", fontFamily: "'JetBrains Mono',monospace" }}>{im.length > 0 ? `${splitIdx + 1}/${im.length}` : "-"}</span>
              <button disabled={splitIdx >= im.length - 1} onClick={() => navSlice(1)} style={P.nv}><ChevronRight size={14} /></button>
              
              <button onClick={() => recording === noteKey ? stopVoice() : startVoice(noteKey)} style={{ ...P.sm, marginLeft: 4, background: recording === noteKey ? "rgba(226,75,74,.18)" : "#1a1d24", color: recording === noteKey ? "#e24b4a" : "#8b919c" }}>{recording === noteKey ? <MicOff size={11} /> : <Mic size={11} />}</button>
              {roi && roi.w > 0.02 && zoomL.scale <= 1 && (
                <button onClick={analyzeRoi} disabled={roiLoading} style={{ ...P.sm, padding: "4px 12px", background: "rgba(224,169,59,.14)", border: "0.5px solid rgba(224,169,59,.3)", color: "#e0a93b" }}>
                  {roiLoading ? "⏳ Визначення..." : <><Crosshair size={12} /> Що це за структура?</>}
                </button>
              )}
              {roi && <button onClick={() => { setRoi(null); setRoiResult(null); }} style={{ ...P.sm, padding: "4px 8px", color: "#8b919c" }}><X size={12} /></button>}
            </div>
            {!roi && zoomL.scale <= 1 && <p style={{ fontSize: 9, color: "#5f6672", textAlign: "center", margin: "2px 0 0" }}>Виділіть мишкою структуру — ІІ допоможе визначити що це</p>}
            {aiMarkers[splitIdx] && zoomL.scale <= 1 && (
               <div style={{ background: "rgba(226,75,74,.15)", border: "1px solid rgba(226,75,74,.3)", color: "#e24b4a", padding: "4px 8px", borderRadius: 6, fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                 <Brain size={12} /> AI Підозра: {aiMarkers[splitIdx]}
               </div>
            )}
        
            {zoomL.scale > 1 && <p style={{ fontSize: 9, color: "#5f6672", textAlign: "center", margin: "2px 0 0" }}>Перетягуйте для переміщення · Ctrl+колесо для зуму</p>}

            {/* EDITABLE NOTE FOR CURRENT SLICE */}
            <div style={{ marginTop: 4, background: "#13161c", border: `0.5px solid ${recording === noteKey ? "rgba(226,75,74,.5)" : vnotes[noteKey]?.trim() ? "rgba(6,182,212,.3)" : "rgba(255,255,255,.07)"}`, borderRadius: 6, padding: "5px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: recording === noteKey ? "#e24b4a" : vnotes[noteKey]?.trim() ? "#06b6d4" : "#8b919c", display: "flex", alignItems: "center", gap: 4 }}>
                  <FileText size={11} /> Нотатка до зрізу #{splitIdx + 1}
                  {recording === noteKey && <span style={{ color: "#e24b4a", fontSize: 9, fontWeight: 700, animation: "pulse 1s infinite" }}>● ЗАПИС...</span>}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button 
                    onClick={() => {
                      if (!im[splitIdx] || !study?.zone) return;
                      const curSlice = im[splitIdx];
                      const sKey = seriesKey();
                      const noteText = vnotes[noteKey]?.trim() || "";
                      const caption = `${sKey} #${splitIdx + 1}${noteText ? ` — ${noteText}` : ""}`;
                      const refObj = {
                        id: Date.now() + Math.random(),
                        name: `${study.patientName || "Пацієнт"} [${sKey} #${splitIdx + 1}]`,
                        data: curSlice.data,
                        caption: caption,
                        ts: Date.now(),
                        src: "patient_slice"
                      };
                      setRefs(p => ({
                        ...p,
                        [study.zone]: [...(p[study.zone] || []), refObj]
                      }));
                      flash(`✅ Зріз додано до референсів норми ("${ZONES[study.zone]?.short || study.zone}")`);
                    }}
                    style={{ background: "rgba(74,163,223,.12)", border: "0.5px solid rgba(74,163,223,.3)", borderRadius: 4, color: "#4aa3df", cursor: "pointer", padding: "2px 6px", fontSize: 9, display: "flex", alignItems: "center", gap: 3 }}
                    title="Зберегти цей якісний зріз у бібліотеку норми"
                  >
                    <BookOpen size={10} /> + в норму
                  </button>
                  {vnotes[noteKey]?.trim() && (
                    <button 
                      onClick={() => {
                        setVnotes(p => {
                          const upd = { ...p };
                          delete upd[noteKey];
                          return upd;
                        });
                        flash("Нотатку зрізу видалено");
                      }} 
                      style={{ background: "transparent", border: "none", color: "#5f6672", cursor: "pointer", padding: "1px 4px", fontSize: 9, display: "flex", alignItems: "center", gap: 2 }}
                      title="Очистити нотатку"
                    >
                      <Trash2 size={10} /> очистити
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={vnotes[noteKey] || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setVnotes(p => ({ ...p, [noteKey]: val }));
                }}
                placeholder="Тут з'явиться розпізнаний голос або введіть опис патології вручну..."
                rows={2}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 4,
                  color: "#e8eaed",
                  fontSize: 11,
                  fontFamily: "inherit",
                  lineHeight: 1.35,
                  padding: "4px 6px",
                  resize: "none",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* RIGHT PANEL: REFERENCE OR COMPARE */}
          <div style={{ background: "#0f1217", border: "0.5px solid rgba(255,255,255,.06)", borderRadius: 8, padding: 4, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            
            {/* Top Toggle: Mode */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 4px", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
              <div style={{ display: "flex", gap: 3 }}>
                <button onClick={() => { setRightMode("ref"); resetZoom("R"); }} style={{ ...(rightMode === "ref" ? P.sqOn : P.sq), padding: "4px 10px", fontSize: 10, fontWeight: 500 }}>Довідники</button>
                <button onClick={() => { setRightMode("compare"); resetZoom("R"); if(!compareSeriesKey) setCompareSeriesKey(Object.keys(study?.series || {})[0]); }} style={{ ...(rightMode === "compare" ? P.sqOn : P.sq), padding: "4px 10px", fontSize: 10, fontWeight: 500 }}>Порівняння</button>
              </div>
              {rightMode === "compare" && (
                <button onClick={() => setSyncScroll(!syncScroll)} style={{ ...P.sm, padding: "4px 8px", background: syncScroll ? "rgba(74,163,223,.18)" : "transparent", color: syncScroll ? "#4aa3df" : "#8b919c", border: "none" }} title="Синхронізувати прокрутку">
                  <Link size={12} />
                </button>
              )}
            </div>

            {rightMode === "ref" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 4px", gap: 6 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[["refs", "Нотатки"], ["atlas", "Атлас"], ["kb", "База знань"]].map(([k, lbl]) => {
                      const cnt = k === "refs" ? collectZoneMaterials(refs, study?.zone).length : k === "atlas" ? collectZoneMaterials(atlas, study?.zone).length : kbEntries.length;
                      return <button key={k} onClick={() => { setRefSource(k); setRefIdx(0); resetZoom("R"); }}
                        style={{ ...refSource === k ? P.sqOn : P.sq, padding: "3px 8px", fontSize: 9 }}>{lbl} ({cnt})</button>;
                    })}
                  </div>
                  {refSource !== "kb" && zoomR.scale > 1 && <button onClick={() => resetZoom("R")} style={{ ...P.sm, padding: "2px 6px", fontSize: 9 }}>{zoomR.scale.toFixed(1)}x</button>}
                </div>

                {refSource === "kb" ? (
                  <div style={{ flex: 1, overflowY: "auto", padding: 4 }}>
                    {kbEntries.length === 0 ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#3a3f47", fontSize: 12 }}>Немає даних для цієї зони</div>
                      : kbEntries.map((e, i) => (
                        <div key={i} style={{ background: "#13161c", border: "0.5px solid rgba(255,255,255,.06)", borderRadius: 6, padding: 10, marginBottom: 6 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 500, color: "#e0a93b", marginBottom: 5 }}>{e.title}</h4>
                          <p style={{ fontSize: 11, color: "#c4c9d0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.text}</p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <>
                    <div onWheel={(e) => onViewerWheel("R", e, navRef)}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: zoomR.scale > 1 ? (panning ? "grabbing" : "grab") : "default", userSelect: "none" }}
                      onContextMenu={(e)=>e.preventDefault()} onMouseDown={(e) => { if (e.button === 2) { onWindowStart("R", e); return; } if (zoomR.scale > 1) onViewerPanStart("R", e); }}>
                      {refImgs[refIdx] ? (
                        <img src={refImgs[refIdx].data} alt="" draggable={false}
                          style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 4, pointerEvents: "none", filter: `brightness(${wlR.b}%) contrast(${wlR.c}%)`, transform: `translate(${zoomR.x}px, ${zoomR.y}px) scale(${zoomR.scale})`, transformOrigin: "center", transition: panning ? "none" : "transform .1s" }} />
                      ) : <span style={{ color: "#3a3f47", fontSize: 12 }}>{refSource === "atlas" ? "Пустий атлас" : "Немає матеріалів"}</span>}
                      {refImgs[refIdx]?.label && <span style={{ position: "absolute", bottom: 4, left: 4, right: 4, background: "rgba(0,0,0,.8)", color: "#e8eaed", fontSize: 10, padding: "3px 6px", borderRadius: 4, lineHeight: 1.3 }}>{refImgs[refIdx].label}</span>}
                    </div>
                    {refImgs.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 0" }}>
                        <button disabled={refIdx <= 0} onClick={() => navRef(-1)} style={P.nv}><ChevronLeft size={14} /></button>
                        <span style={{ fontSize: 10, color: "#8b919c", fontFamily: "'JetBrains Mono',monospace" }}>{refIdx + 1}/{refImgs.length}</span>
                        <button disabled={refIdx >= refImgs.length - 1} onClick={() => navRef(1)} style={P.nv}><ChevronRight size={14} /></button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              /* COMPARE MODE */
              <>
                {/* Study Selector for Cross-Study / Longitudinal Comparison */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px 6px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 4 }}>
                  <Calendar size={13} color="#4aa3df" />
                  <span style={{ fontSize: 10, color: "#8b919c", whiteSpace: "nowrap" }}>Дослідження:</span>
                  <select
                    value={compareStudyId || ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setCompareStudyId(val);
                      resetZoom("R");
                    }}
                    style={{
                      flex: 1,
                      background: "#13161c",
                      border: "1px solid rgba(74,163,223,0.3)",
                      borderRadius: 4,
                      color: compareStudyId ? "#4aa3df" : "#e8eaed",
                      fontSize: 10,
                      padding: "3px 6px",
                      outline: "none",
                      cursor: "pointer"
                    }}
                  >
                    <option value="">
                      Поточне ({study?.date || "без дати"}) — {study?.patientName || "Пацієнт"}
                    </option>
                    {(() => {
                      const currentPatient = (study?.patientName || "").trim().toLowerCase();
                      const otherStudies = (studies || []).filter(s => s.id !== study?.id);
                      // Sort same patient's studies first
                      const samePatient = otherStudies.filter(s => (s.pn || "").trim().toLowerCase() === currentPatient);
                      const differentPatient = otherStudies.filter(s => (s.pn || "").trim().toLowerCase() !== currentPatient);

                      return (
                        <>
                          {samePatient.length > 0 && (
                            <optgroup label="— Дослідження цього пацієнта (динаміка) —">
                              {samePatient.map(s => (
                                <option key={s.id} value={s.id}>
                                  📅 {s.mriDate || s.d} · {ZONES[s.z]?.short || s.z} ({s.ic} зрізів)
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {differentPatient.length > 0 && (
                            <optgroup label="— Інші пацієнти / дослідження —">
                              {differentPatient.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.pn || "Анонім"} · {s.mriDate || s.d} · {ZONES[s.z]?.short || s.z}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </select>
                  {loadingCompareStudy && (
                    <span style={{ fontSize: 9, color: "#4aa3df", animation: "pulse 1s infinite" }}>Завантаження...</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", padding: "0 4px 4px" }}>
                  {Object.entries(rightSeriesObj).map(([k, a]) => {
                    const cnt = a.length;
                    const { zone: sZone, seq, plane } = parseSeriesKey(k, activeRightStudy?.zone);
                    const isMultiZone = (activeRightStudy?.zones && activeRightStudy.zones.length > 1);
                    const zoneTag = isMultiZone && sZone && ZONES[sZone] ? `[${ZONES[sZone].short}] ` : "";
                    return (
                      <button key={k} onClick={() => { setCompareSeriesKey(k); setCompareIdx(0); resetZoom("R"); }}
                        style={{ ...k === compareSeriesKey ? P.sqOn : P.sq, padding: "3px 8px", fontSize: 9 }}>{zoneTag}{seq} {plane} ({cnt})</button>
                    );
                  })}
                  {zoomR.scale > 1 && <button onClick={() => resetZoom("R")} style={{ ...P.sm, padding: "2px 6px", fontSize: 9, marginLeft: "auto" }}>{zoomR.scale.toFixed(1)}x</button>}
                  {(wlR.b !== 100 || wlR.c !== 100) && <button onClick={() => setWlR({b:100, c:100})} style={{ ...P.sm, padding: "2px 6px", fontSize: 9, color: "#e0a93b", marginLeft: "auto" }}>W/L</button>}
                </div>
                
                <div onWheel={(e) => onViewerWheel("R", e, navCompare)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: zoomR.scale > 1 ? (panning ? "grabbing" : "grab") : "default", userSelect: "none" }}
                  onContextMenu={(e)=>e.preventDefault()} onMouseDown={(e) => { if (e.button === 2) { onWindowStart("R", e); return; } if (zoomR.scale > 1) onViewerPanStart("R", e); }}>
                  {compImgs[compareIdx] ? (
                    <>
                      <img src={compImgs[compareIdx].data} alt="" draggable={false}
                        style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 4, pointerEvents: "none", filter: `brightness(${wlR.b}%) contrast(${wlR.c}%)`, transform: `translate(${zoomR.x}px, ${zoomR.y}px) scale(${zoomR.scale})`, transformOrigin: "center", transition: panning ? "none" : "transform .1s" }} />
                      
                      {/* Localizer Scout Line Layer on Right Viewer */}
                      {zoomR.scale <= 1 && localizerOnRight && (
                        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}>
                          <g>
                            <line 
                              x1={localizerOnRight.x1 * 1000} 
                              y1={localizerOnRight.y1 * 1000} 
                              x2={localizerOnRight.x2 * 1000} 
                              y2={localizerOnRight.y2 * 1000} 
                              stroke="#facc15" 
                              strokeWidth="1.8" 
                              vectorEffect="non-scaling-stroke" 
                              strokeDasharray="8 4"
                              style={{ filter: "drop-shadow(0px 0px 3px rgba(0,0,0,0.9))" }}
                            />
                            <circle cx={localizerOnRight.x1 * 1000} cy={localizerOnRight.y1 * 1000} r="3" fill="#facc15" />
                            <circle cx={localizerOnRight.x2 * 1000} cy={localizerOnRight.y2 * 1000} r="3" fill="#facc15" />
                            <text 
                              x={((localizerOnRight.x1 + localizerOnRight.x2) / 2) * 1000} 
                              y={((localizerOnRight.y1 + localizerOnRight.y2) / 2) * 1000} 
                              fill="#facc15" 
                              fontSize="20" 
                              fontWeight="700" 
                              fontFamily="'JetBrains Mono',monospace"
                              style={{ textShadow: "1px 1px 3px #000, -1px -1px 3px #000" }} 
                              dx="6" 
                              dy="-6"
                            >
                              {leftPlane ? `${leftPlane.slice(0, 3)}: ${splitIdx + 1}` : `${splitIdx + 1}`}
                            </text>
                          </g>
                        </svg>
                      )}

                      <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: "#e8eaed", fontFamily: "'JetBrains Mono',monospace", pointerEvents: "none" }}>
                        <span style={{ color: "#4aa3df", fontWeight: 600 }}>📅 {activeRightStudy?.mriDate || activeRightStudy?.date || "—"}</span> · {compareSeriesKey ? parseSeriesKey(compareSeriesKey, activeRightStudy?.zone).seq + " " + parseSeriesKey(compareSeriesKey, activeRightStudy?.zone).plane : ""}
                      </div>
                    </>
                  ) : <span style={{ color: "#3a3f47", fontSize: 12 }}>Виберіть серію</span>}
                </div>
                {compImgs.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 0" }}>
                    <button disabled={compareIdx <= 0} onClick={() => navCompare(-1)} style={P.nv}><ChevronLeft size={14} /></button>
                    <span style={{ fontSize: 10, color: "#8b919c", fontFamily: "'JetBrains Mono',monospace" }}>{compareIdx + 1}/{compImgs.length}</span>
                    <button disabled={compareIdx >= compImgs.length - 1} onClick={() => navCompare(1)} style={P.nv}><ChevronRight size={14} /></button>
                  </div>
                )}
              </>
            )}
          </div>
          </div>
          {/* ROI RESULT PANEL — ORIENTATION MODE */}
          {roiResult && (() => {
            const cands = roiResult.candidates || [];
            const idConf = roiResult.id_confidence_overall ?? (cands[0]?.id_confidence ?? 0);
            const confColorVal = idConf >= 80 ? "#4ec99b" : idConf >= 60 ? "#e0a93b" : "#e24b4a";
            const anat = roiResult.anatomy || {};
            return (
              <div style={{ background: "#13161c", border: "0.5px solid rgba(224,169,59,.18)", borderRadius: 8, padding: 12, overflowY: "auto", flex: 1 }}>
                <h4 style={{ fontSize: 13, fontWeight: 500, color: "#e0a93b", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Crosshair size={14} /> Орієнтація — що це за структура</h4>
                <p style={{ fontSize: 10, color: "#5f6672", marginBottom: 10, lineHeight: 1.4 }}>ІІ допомагає визначити анатомію. Рішення про патологію — за лікарем.</p>

                {/* Candidates */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 10, color: "#8b919c", textTransform: "uppercase", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace" }}>Кандидати структури</p>
                  {cands.map((c, i) => (
                    <div key={i} style={{ background: i === 0 ? "rgba(74,163,223,.07)" : "#0f1217", border: `0.5px solid ${i === 0 ? "rgba(74,163,223,.25)" : "rgba(255,255,255,.05)"}`, borderRadius: 6, padding: "8px 10px", marginBottom: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#e8eaed" : "#c4c9d0" }}>{i === 0 && "★ "}{c.structure}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace", color: c.id_confidence >= 80 ? "#4ec99b" : c.id_confidence >= 60 ? "#e0a93b" : "#e24b4a", whiteSpace: "nowrap" }}>{c.id_confidence}%</span>
                      </div>
                      {c.reasoning && <p style={{ fontSize: 11, color: "#8b919c", lineHeight: 1.4 }}>{c.reasoning}</p>}
                    </div>
                  ))}
                </div>

                {/* Overall ID confidence */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 10px", background: "#0f1217", borderRadius: 6 }}>
                  <span style={{ fontSize: 11, color: "#8b919c" }}>Впевненість в ідентифікації:</span>
                  <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace", color: confColorVal }}>{idConf}%</span>
                </div>

                {/* Uncertainty note */}
                {roiResult.uncertainty_note && (
                  <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(224,169,59,.06)", border: "0.5px solid rgba(224,169,59,.15)", borderRadius: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 500, color: "#e0a93b", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><AlertCircle size={11} /> Що ускладнює визначення</p>
                    <p style={{ fontSize: 11, color: "#c4c9d0", lineHeight: 1.4 }}>{roiResult.uncertainty_note}</p>
                  </div>
                )}

                {/* Anatomy reference */}
                {(anat.description || anat.function || anat.origin) && (
                  <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(155,140,219,.06)", border: "0.5px solid rgba(155,140,219,.12)", borderRadius: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 500, color: "#9b8cdb", textTransform: "uppercase", marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>Анатомічна довідка</p>
                    {anat.description && <p style={{ fontSize: 11, color: "#c4c9d0", marginBottom: 4, lineHeight: 1.4 }}>{anat.description}</p>}
                    {anat.function && <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#9b8cdb", fontWeight: 500 }}>Функція: </span><span style={{ fontSize: 11, color: "#8b919c" }}>{anat.function}</span></div>}
                    {anat.origin && <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#9b8cdb", fontWeight: 500 }}>Початок: </span><span style={{ fontSize: 11, color: "#8b919c" }}>{anat.origin}</span></div>}
                    {anat.insertion && <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#9b8cdb", fontWeight: 500 }}>Прикріплення: </span><span style={{ fontSize: 11, color: "#8b919c" }}>{anat.insertion}</span></div>}
                    {anat.innervation && <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#9b8cdb", fontWeight: 500 }}>Іннервація: </span><span style={{ fontSize: 11, color: "#8b919c" }}>{anat.innervation}</span></div>}
                    {anat.typical_pathologies && (
                      <div style={{ marginTop: 4, paddingTop: 4, borderTop: "0.5px solid rgba(155,140,219,.1)" }}>
                        <span style={{ fontSize: 10, color: "#e0a93b", fontWeight: 500 }}>Типові патології тут: </span><span style={{ fontSize: 11, color: "#c4c9d0" }}>{anat.typical_pathologies}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* What to check */}
                {roiResult.what_to_check && (
                  <div style={{ background: "rgba(74,163,223,.07)", borderRadius: 6, padding: "8px 10px" }}>
                    <p style={{ fontSize: 10, color: "#4aa3df", fontWeight: 500, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><Eye size={11} /> На що звернути увагу</p>
                    <p style={{ fontSize: 11, color: "#c4c9d0", lineHeight: 1.4 }}>{roiResult.what_to_check}</p>
                  </div>
                )}

                <p style={{ fontSize: 9, color: "#5f6672", marginTop: 10, lineHeight: 1.4, textAlign: "center" }}>Остаточне рішення про патологію приймає лікар на основі знімка</p>
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

