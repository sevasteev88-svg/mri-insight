import React from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { 
  ArrowLeft, CheckCircle, BookOpen, Columns, FileText, 
  Save, Star, Eye, Trash2, Info, ExternalLink, Paperclip, 
  Upload, Brain, Mic, Shield, Archive, X, ScanText 
} from "lucide-react";
import { ZONES } from "../constants/anatomy.js";
import { confColor, radioUrl } from "../utils/helpers.js";
import { dbPut } from "../services/db.js";
import { supabase } from "../services/supabase.js";

export default function Results() {
  const {
    study, setStudy, setScr, totalCount, setStudies, flash,
    refs, setShowRefP, goSplit, generateReport, vnotes, setVnotes,
    goToSlice, attachIn, reviewConclusion, reviewLoading, setViewImg,
    handleAttachment, recording, stopVoice, startVoice, recRef, setRecording,
    setShowReport, setReportText, conclusionReview, confirmConclusion,
    archiveStudy, deleteStudy, extractConclusionText, ocrLoading
  } = React.useContext(AppContext);

  const f = study?.findings || [];
  const zr = refs[study?.zone] || [];

  return (
    <div style={P.pg}>
      <div style={P.top}>
        <button onClick={() => setScr("dash")} style={P.bk}>
          <ArrowLeft size={16} /> Головна
        </button>
        <h2 style={P.pT}>Результати</h2>
      </div>

      <div style={P.resH}>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9" }}>{study?.patientName || "Пацієнт"}</p>
          <p style={P.sM}>{ZONES[study?.zone]?.ua} · {Object.entries(study?.series || {}).filter(([_, a]) => a.length > 0).map(([s]) => s).join(", ")} · {study?.date}</p>
          <p style={P.sM}>{totalCount()} зрізів</p>
        </div>
        <span style={f.length > 0 ? P.bdLg : P.bdOk}>
          {f.length > 0 ? `${f.length} знахідок` : <><CheckCircle size={14} /> Норма</>}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {totalCount() > 0 && (
          <button onClick={() => goSplit("results")} style={{ ...P.pri, padding: "10px 18px", fontSize: 13, background: "#1d6ea8", display: "flex", alignItems: "center", gap: 8 }}>
            <Columns size={16} /> Переглянути зрізи у Split-Screen
          </button>
        )}
        <button 
          onClick={async () => {
            if (!study) return;
            try {
              // Keep only notes that belong to series existing in the current study
              const validSeriesKeys = new Set(Object.keys(study.series || {}));
              const rawMerged = { ...(study.vnotes || {}), ...vnotes };
              const cleanVnotes = {};
              for (const [k, text] of Object.entries(rawMerged)) {
                if (!text || !text.trim()) continue;
                // e.g. "knee__PD Fat Sat_Sag-11" -> seriesKey is "knee__PD Fat Sat_Sag"
                const lastDash = k.lastIndexOf("-");
                const sKey = lastDash !== -1 ? k.substring(0, lastDash) : k;
                // If study has series, ensure sKey is in study.series or starts with study.zone
                if (validSeriesKeys.size > 0) {
                  if (validSeriesKeys.has(sKey) || sKey.startsWith(study.zone + "__")) {
                    cleanVnotes[k] = text.trim();
                  }
                } else {
                  cleanVnotes[k] = text.trim();
                }
              }

              // Also clean keyImages to ensure they belong to current study's series or zone
              const cleanKeyImages = (study.keyImages || []).filter(kImg => {
                if (!kImg) return false;
                if (study.zone && kImg.zone && kImg.zone !== study.zone) return false;
                return true;
              });

              // 1. Sync to Supabase
              // Check if study.id is a valid UUID
              const isUuid = typeof study.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(study.id);
              const supaId = isUuid ? study.id : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined);
              const targetId = supaId || study.id;

              const toSave = { 
                ...study, 
                id: targetId,
                vnotes: cleanVnotes,
                keyImages: cleanKeyImages,
                status: (study.findings || []).length > 0 ? "done" : "draft" 
              };
              setStudy(toSave);
              setVnotes(cleanVnotes);

              // Always save to IndexedDB under both original id and targetId so it never gets lost
              await dbPut("studies", String(targetId), toSave);
              if (String(study.id) !== String(targetId)) {
                await dbPut("studies", String(study.id), toSave);
              }

              const supaPayload = {
                ...(supaId ? { id: supaId } : {}),
                patient_name: study.patientName || "Без імені",
                age: study.age || null,
                complaints: study.complaints || null,
                mechanism: study.mechanism || null,
                zone: study.zone || "knee",
                study_date: study.date || new Date().toISOString().split('T')[0],
                mri_date: study.mriDate || study.date || null,
                total_images: totalCount(),
                doctor_notes: cleanVnotes,
                ai_report: study.doctorReport || null,
                key_images: cleanKeyImages,
                findings: [
                  ...(study.findings || []),
                  {
                    _extra: {
                      doctorNotesText: study.doctorNotes || "",
                      attachments: study.attachments || [],
                      conclusionReview: conclusionReview || study.conclusionReview || null
                    }
                  }
                ],
                archived: study.archived || false,
                updated_at: new Date().toISOString()
              };

              let supaSuccess = false;
              let savedRowId = null;
              try {
                const { data: savedRow, error: supaErr } = await supabase
                  .from("studies")
                  .upsert(supaPayload)
                  .select()
                  .single();

                if (supaErr) {
                  console.error("Supabase upsert error:", supaErr);
                  flash(`Збережено локально! Хмара повідомила: ${supaErr.message || JSON.stringify(supaErr)}`);
                } else if (savedRow?.id) {
                  supaSuccess = true;
                  savedRowId = savedRow.id;
                  setStudy(p => ({ ...p, id: savedRow.id }));
                  // Ensure saved under final Supabase row id in local db as well
                  await dbPut("studies", String(savedRow.id), { ...toSave, id: savedRow.id });
                }
              } catch (cloudErr) {
                console.warn("Supabase network error:", cloudErr);
                flash(`Збережено локально! Помилка мережі хмари: ${cloudErr.message || cloudErr}`);
              }

              // 2. Ensure listed in studies overview
              const fc = (study.findings || []).length;
              const studyIdToUse = savedRowId || targetId;
              const meta = { 
                id: studyIdToUse, 
                pn: study.patientName, 
                z: study.zone, 
                d: study.date || new Date().toLocaleDateString("uk-UA"), 
                mriDate: study.mriDate || study.date, 
                ic: totalCount(), 
                fc, 
                archived: study.archived || false, 
                hasNotes: Object.keys(cleanVnotes).length > 0 || Boolean(study.doctorNotes)
              };

              setStudies(p => {
                const filtered = (p || []).filter(x => x.id !== study.id && x.id !== studyIdToUse);
                const updated = [meta, ...filtered];
                try { localStorage.setItem("mri-hist", JSON.stringify(updated)); } catch {}
                return updated;
              });

              if (supaSuccess) {
                flash("Картку пацієнта, анамнез, нотатки та вкладення успішно збережено в хмару!");
              }
            } catch(e) {
              console.error("Save error:", e);
              flash(`Помилка збереження: ${e.message || e}`);
            }
          }} 
          style={{ ...P.sm, padding: "10px 18px", background: "rgba(34,197,94,.18)", color: "#4ec99b", border: "1px solid rgba(34,197,94,.35)", fontSize: 12, fontWeight: 600 }}
        >
          <Save size={15} style={{ marginRight: 6 }} /> Зберегти дослідження
        </button>
        {zr.length > 0 && (
          <button onClick={() => setShowRefP(true)} style={{ ...P.rvBtn, padding: "10px 14px", fontSize: 12 }}>
            <BookOpen size={14} /> Довідник норми ({zr.length})
          </button>
        )}
      </div>

      {/* KEY IMAGES */}
      {(() => {
        const displayedKeyImages = (study?.keyImages || []).filter(kImg => {
          if (!kImg) return false;
          if (study?.zone && kImg.zone && kImg.zone !== study.zone) return false;
          return true;
        });

        if (displayedKeyImages.length === 0) return null;

        return (
          <div style={{ background: "#13161c", border: "1px solid rgba(224,169,59,.3)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e0a93b", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                <Star size={15} fill="#e0a93b" /> Ключові кадри патологій ({displayedKeyImages.length})
              </h3>
              <span style={{ fontSize: 10, color: "#8b919c" }}>Зберігаються в хмарі для перегляду з планшета</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
              {displayedKeyImages.map((kImg, i) => (
                <div key={kImg.id || i} style={{ background: "#0f1217", border: "0.5px solid rgba(255,255,255,.08)", borderRadius: 8, overflow: "hidden" }}>
                  <img 
                    src={kImg.data} 
                    alt={`Зріз ${kImg.sliceIdx}`} 
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", cursor: "pointer" }} 
                    onClick={() => setViewImg({ data: kImg.data, name: `${kImg.seq} ${kImg.plane} — Зріз ${kImg.sliceIdx}` })}
                  />
                  <div style={{ padding: "6px 8px" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
                      {kImg.seq} {kImg.plane} #{kImg.sliceIdx}
                    </p>
                    {kImg.note && (
                      <p style={{ fontSize: 10, color: "#94a3b8", margin: "3px 0 0", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={kImg.note}>
                        {kImg.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* SLICE-BY-SLICE DOCTOR NOTES */}
      {(() => {
        const validSeriesKeys = new Set(Object.keys(study?.series || {}));
        const allSliceNotes = Object.entries(vnotes || {})
          .filter(([k, v]) => {
            if (!v || !v.trim()) return false;
            if (validSeriesKeys.size === 0) return true;
            const lastDash = k.lastIndexOf("-");
            const sKey = lastDash !== -1 ? k.substring(0, lastDash) : k;
            return validSeriesKeys.has(sKey) || (study?.zone && sKey.startsWith(study.zone + "__"));
          })
          .map(([k, v]) => ({ key: k, text: v.trim() }));
        
        return (
          <div style={{ background: "#13161c", border: "1px solid rgba(6,182,212,.25)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#06b6d4", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                <FileText size={15} /> Пошарові нотатки та знахідки лікаря ({allSliceNotes.length})
              </h3>
              {totalCount() > 0 && (
                <button onClick={() => goSplit("results")} style={{ ...P.sm, color: "#06b6d4", padding: "3px 8px", fontSize: 11 }}>
                  + Додати нотатку у Split-Screen
                </button>
              )}
            </div>

            {allSliceNotes.length === 0 ? (
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                Немає збережених пошарових нотаток. Відкрийте <span onClick={() => goSplit("results")} style={{ color: "#06b6d4", cursor: "pointer", textDecoration: "underline" }}>Split-Screen</span> і надиктуйте голосом опис пошкоджень біля будь-якого зрізу.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allSliceNotes.map(n => (
                  <div key={n.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0b0e14", padding: "8px 12px", borderRadius: 6, border: "0.5px solid rgba(255,255,255,.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span 
                        onClick={() => goToSlice(n.key)}
                        style={{ fontSize: 11, fontWeight: 600, color: "#4aa3df", background: "rgba(74,163,223,.12)", padding: "2px 8px", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        title="Перейти до цього зрізу у в'ювері"
                      >
                        <Eye size={12} /> {n.key} →
                      </span>
                      <span style={{ fontSize: 12, color: "#e2e8f0" }}>{n.text}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setVnotes(p => {
                          const upd = { ...p };
                          delete upd[n.key];
                          return upd;
                        });
                      }} 
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}
                      title="Видалити"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {study?.summary && <div style={P.sumC}><h4 style={P.sumT}>Висновок</h4><p style={P.sumTx}>{study.summary}</p></div>}
      {study?.recommendation && <div style={{ ...P.sumC, borderColor: "#06b6d4" }}><h4 style={{ ...P.sumT, color: "#06b6d4" }}>Рекомендація</h4><p style={P.sumTx}>{study.recommendation}</p></div>}

      {f.some(x => x.pulse_sequence_hint) && (
        <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Info size={13} /> Підказки щодо послідовностей
          </h4>
          {f.filter(x => x.pulse_sequence_hint).map((x, i) => <p key={i} style={{ fontSize: 12, color: "#fbbf24", marginTop: 3 }}>• {x.pulse_sequence_hint}</p>)}
        </div>
      )}

      {f.length > 0 && (
        <div>
          <h3 style={P.secT}>Знахідки</h3>
          {f.map((x, i) => {
            const cc = confColor(x.confidence_level || 50);
            return (
              <div key={x.id || i} style={P.fCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{x.structure}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: cc.bg, color: cc.c, fontFamily: "'JetBrains Mono',monospace" }}>{x.confidence_level ?? "?"}%</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#94a3b8" }}>{x.description}</p>
                {x.differential?.length > 0 && (
                  <div style={{ marginTop: 6, padding: "6px 8px", background: "rgba(139,92,246,.06)", borderRadius: 6 }}>
                    <p style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600, marginBottom: 3, textTransform: "uppercase" }}>Диференційна діагностика</p>
                    {x.differential.map((d, di) => (
                      <div key={di} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#cbd5e1", padding: "1px 0" }}>
                        <span>{d.diagnosis}</span>
                        <span style={{ color: d.likelihood === "висока" ? "#22c55e" : d.likelihood === "низька" ? "#64748b" : "#eab308", fontWeight: 600 }}>{d.likelihood}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  {x.slices && x.slices !== "-" && (
                    <span onClick={() => goToSlice(x.slices)} style={{ fontSize: 11, color: "#06b6d4", display: "flex", alignItems: "center", gap: 3, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      <Eye size={12} /> Зрізи: {x.slices} →
                    </span>
                  )}
                  {x.acuity && x.acuity !== "невизначено" && (
                    <span style={{ fontSize: 10, color: "#94a3b8", background: "rgba(255,255,255,.05)", padding: "1px 7px", borderRadius: 5 }}>{x.acuity}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {study?.radio?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h3 style={P.secT}>Radiopaedia · Довідник</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {study.radio.map((t, i) => (
              <a key={i} href={radioUrl(t)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#06b6d4", background: "rgba(6,182,212,.1)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 7, padding: "4px 9px", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
                {t} <ExternalLink size={10} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ATTACHMENTS — MRI conclusion from imaging center */}
      <div style={{ marginTop: 16 }}>
        <h3 style={P.secT}><Paperclip size={14} style={{ marginRight: 4 }} />Заключення МРТ від центру</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => attachIn.current?.click()} style={{ ...P.sm, padding: "8px 14px", fontSize: 12, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", color: "#f59e0b" }}>
            <Upload size={14} style={{ marginRight: 4 }} /> Додати файл (фото/PDF)
          </button>
          {(study?.attachments || []).length > 0 && (
            <>
              <button 
                onClick={extractConclusionText} 
                disabled={ocrLoading} 
                style={{ ...P.sm, padding: "8px 14px", fontSize: 12, background: "rgba(6,182,212,.12)", border: "1px solid rgba(6,182,212,.25)", color: "#06b6d4" }}
                title="Розпізнати текст висновку з фото та перенести в картку пацієнта"
              >
                {ocrLoading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Розпізнавання OCR...</> : <><ScanText size={14} style={{ marginRight: 4 }} /> Розпізнати текст через ІІ</>}
              </button>
              <button onClick={reviewConclusion} disabled={reviewLoading} style={{ ...P.sm, padding: "8px 14px", fontSize: 12, background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.2)", color: "#a78bfa" }}>
                {reviewLoading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Аналіз...</> : <><Brain size={14} style={{ marginRight: 4 }} /> ІІ оцінка заключення</>}
              </button>
            </>
          )}
          <input ref={attachIn} type="file" multiple accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => handleAttachment(e.target.files)} />
        </div>
        {(study?.attachments || []).length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
            {study.attachments.filter(Boolean).map((att) => {
              const isImage = (att.type && typeof att.type === "string" && att.type.startsWith("image/")) || 
                              (att.data && typeof att.data === "string" && att.data.startsWith("data:image/")) ||
                              (att.name && /\.(png|jpe?g|webp|gif)$/i.test(att.name));
              return (
                <div key={att.id || att.name} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                  {isImage ? (
                    <img src={att.data} alt={att.name || "Вкладення"} style={{ width: "100%", display: "block", cursor: "pointer", borderRadius: "8px 8px 0 0" }} onClick={() => setViewImg(att)} />
                  ) : (
                    <div onClick={() => { if (att.data) { const w = window.open(); w.document.write(`<iframe src="${att.data}" style="width:100%;height:100vh;border:none"></iframe>`); } }} style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(245,158,11,.06)" }}>
                      <FileText size={28} style={{ color: "#f59e0b" }} />
                    </div>
                  )}
                  <div style={{ padding: "4px 6px" }}>
                    <p style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name || "Файл"}</p>
                  </div>
                  <button onClick={async () => {
                    const upd = (study.attachments || []).filter(a => a.id !== att.id);
                    setStudy(p => ({ ...p, attachments: upd }));
                    try { await dbPut("studies", String(study.id), { ...study, attachments: upd }); } catch {}
                    try {
                      const isUuid = typeof study.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(study.id);
                      if (isUuid) {
                        await supabase.from("studies").update({
                          findings: [
                            ...(study.findings || []).filter(item => !item?._extra),
                            {
                              _extra: {
                                doctorNotesText: study.doctorNotes || "",
                                attachments: upd,
                                conclusionReview: conclusionReview || study.conclusionReview || null
                              }
                            }
                          ],
                          updated_at: new Date().toISOString()
                        }).eq("id", study.id);
                      }
                    } catch {}
                  }} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.7)", border: "none", borderRadius: 4, padding: 2, color: "#ef4444", cursor: "pointer" }}><X size={10} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DOCTOR'S CLINICAL NOTES & PATIENT CARD */}
      <div style={{ marginTop: 16, background: "#13161c", border: "1px solid rgba(74,163,223,.2)", borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#4aa3df", display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
            <FileText size={15} /> Клінічна картка · Замітки та висновок лікаря
          </h3>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => {
              if (recording === "doctorNotes") stopVoice();
              else {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SR) { flash("Голосовий ввід не підтримується у цьому браузері"); return; }
                const r = new SR(); r.lang = "uk-UA"; r.continuous = true; r.interimResults = false;
                r.onresult = e => { 
                  const t = Array.from(e.results).map(x => x[0].transcript).join(" "); 
                  setStudy(p => {
                    const updated = { ...p, doctorNotes: (p.doctorNotes ? p.doctorNotes + " " : "") + t };
                    dbPut("studies", String(p.id), updated).catch(()=>{});
                    return updated;
                  });
                };
                r.onend = () => setRecording(null); 
                r.onerror = () => setRecording(null);
                recRef.current = r; r.start(); setRecording("doctorNotes");
              }
            }} style={{ ...P.sm, padding: "5px 10px", background: recording === "doctorNotes" ? "#ef4444" : "rgba(239,68,68,.12)", color: recording === "doctorNotes" ? "#fff" : "#f87171", border: "1px solid rgba(239,68,68,.3)" }}>
              <Mic size={13} style={{ marginRight: 4 }} /> {recording === "doctorNotes" ? "Зупинити запис" : "Надиктувати голосом"}
            </button>
            <button onClick={async () => {
              if (!study) return;
              try {
                await dbPut("studies", String(study.id), study);
                // Also update in Supabase if study.id is a UUID or exists
                try {
                  const isUuid = typeof study.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(study.id);
                  if (isUuid) {
                    await supabase.from("studies").update({
                      complaints: study.complaints || null,
                      mechanism: study.mechanism || null,
                      findings: [
                        ...(study.findings || []),
                        {
                          _extra: {
                            doctorNotesText: study.doctorNotes || "",
                            attachments: study.attachments || [],
                            conclusionReview: conclusionReview || study.conclusionReview || null
                          }
                        }
                      ],
                      updated_at: new Date().toISOString()
                    }).eq("id", study.id);
                  }
                } catch (cErr) {
                  console.warn("Supabase card update error:", cErr);
                }
                flash("Збережено в картку пацієнта та оновлено в хмарі!");
              } catch { flash("Помилка збереження"); }
            }} style={{ ...P.sm, padding: "5px 12px", background: "rgba(74,163,223,.15)", color: "#4aa3df", border: "1px solid rgba(74,163,223,.3)" }}>
              <Save size={13} style={{ marginRight: 4 }} /> Зберегти
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ background: "#0f1217", borderRadius: 6, padding: "8px 10px", border: "0.5px solid rgba(255,255,255,.05)" }}>
            <span style={{ fontSize: 10, color: "#8b919c", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Скарги</span>
            <p style={{ fontSize: 12, color: "#e2e8f0" }}>{study?.complaints || "Не вказано"}</p>
          </div>
          <div style={{ background: "#0f1217", borderRadius: 6, padding: "8px 10px", border: "0.5px solid rgba(255,255,255,.05)" }}>
            <span style={{ fontSize: 10, color: "#8b919c", textTransform: "uppercase", display: "block", marginBottom: 2 }}>Анамнез / Механізм травми</span>
            <p style={{ fontSize: 12, color: "#e2e8f0" }}>{study?.mechanism || "Не вказано"}</p>
          </div>
        </div>

        <textarea 
          value={study?.doctorNotes || ""} 
          onChange={e => {
            const val = e.target.value;
            setStudy(p => {
              const upd = { ...p, doctorNotes: val };
              dbPut("studies", String(p.id), upd).catch(()=>{});
              return upd;
            });
          }} 
          placeholder="Введіть або надиктуйте ваші особисті спостереження, висновки про травму, рекомендації або опис знахідок..." 
          rows={4}
          style={{ width: "100%", background: "#0f1217", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: 10, color: "#e8eaed", fontSize: 12, lineHeight: 1.5, fontFamily: "'IBM Plex Sans',sans-serif", resize: "vertical", outline: "none" }}
        />

        {study?.doctorReport && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#8b5cf6", display: "flex", alignItems: "center", gap: 4 }}>
                <FileText size={13} /> Збережений протокол лікаря
              </span>
              <button onClick={() => { setReportText(study.doctorReport); setShowReport(true); }} style={{ ...P.sm, padding: "2px 8px", fontSize: 10, color: "#8b5cf6" }}>Відкрити протокол</button>
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto", background: "#0b0e14", padding: 8, borderRadius: 4 }}>{study.doctorReport}</p>
          </div>
        )}
      </div>

      {/* AI CONCLUSION REVIEW */}
      {(conclusionReview || study?.conclusionReview) && (() => {
        const rev = conclusionReview || study?.conclusionReview;
        const agreeColor = { agree: "#22c55e", partial: "#eab308", disagree: "#ef4444" };
        const agreeLabel = { agree: "Згоден", partial: "Частково згоден", disagree: "Не згоден" };
        const agreeEmoji = { agree: "✅", partial: "⚠️", disagree: "❌" };
        return (
          <div style={{ background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.18)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "#a78bfa", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Brain size={16} /> Оцінка ІІ заключення центру
            </h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "10px 14px", background: `${agreeColor[rev.overall_agreement] || agreeColor.partial}15`, borderRadius: 8, border: `1px solid ${agreeColor[rev.overall_agreement] || agreeColor.partial}30` }}>
              <span style={{ fontSize: 24 }}>{agreeEmoji[rev.overall_agreement] || "⚠️"}</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: agreeColor[rev.overall_agreement] || "#eab308" }}>{agreeLabel[rev.overall_agreement] || "Частково"}</p>
                <p style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>{rev.overall_comment}</p>
              </div>
            </div>

            {rev.details?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase" }}>Детальне порівняння</p>
                {rev.details.map((d, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,.03)", borderRadius: 8, padding: 10, marginBottom: 6, borderLeft: `3px solid ${agreeColor[d.agreement] || "#eab308"}` }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>{d.point}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}><span style={{ color: "#f59e0b" }}>Центр:</span> {d.center_says}</p>
                    <p style={{ fontSize: 11, color: "#06b6d4" }}>ІІ: {d.ai_says}</p>
                    {d.comment && <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2, fontStyle: "italic" }}>{d.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {rev.missed_by_center?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>Можливо пропущено центром:</p>
                {rev.missed_by_center.map((m, i) => <p key={i} style={{ fontSize: 12, color: "#fbbf24", marginLeft: 8 }}>• {m}</p>)}
              </div>
            )}

            {rev.missed_by_ai?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#06b6d4", marginBottom: 4 }}>ІІ міг пропустити:</p>
                {rev.missed_by_ai.map((m, i) => <p key={i} style={{ fontSize: 12, color: "#67e8f9", marginLeft: 8 }}>• {m}</p>)}
              </div>
            )}

            {rev.recommendation && (
              <div style={{ background: "rgba(6,182,212,.08)", borderRadius: 8, padding: 10, marginTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#06b6d4", marginBottom: 2 }}>Рекомендація:</p>
                <p style={{ fontSize: 12, color: "#cbd5e1" }}>{rev.recommendation}</p>
              </div>
            )}

            {!study?.confirmed && (
              <button onClick={confirmConclusion} style={{ ...P.pri, marginTop: 12, background: "#22c55e" }}>
                <CheckCircle size={16} style={{ marginRight: 6 }} /> Підтвердити заключення — зберегти для навчання ІІ
              </button>
            )}
            {study?.confirmed && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 12px", background: "rgba(34,197,94,.1)", borderRadius: 8 }}>
                <CheckCircle size={16} style={{ color: "#22c55e" }} />
                <p style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Заключення підтверджено · Випадок збережено для навчання</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* ARCHIVE AND DELETE BUTTONS */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={() => archiveStudy(study.id)} style={{ ...P.sm, padding: "10px 16px", fontSize: 12, flex: 1, justifyContent: "center", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.18)", color: "#a78bfa" }}>
          <Archive size={14} style={{ marginRight: 4 }} /> В архів
        </button>
        <button onClick={() => { if (confirm("Видалити це дослідження назавжди?")) deleteStudy(study.id); }} style={{ ...P.sm, padding: "10px 16px", fontSize: 12, flex: 1, justifyContent: "center", background: "rgba(226,75,74,.08)", border: "1px solid rgba(226,75,74,.2)", color: "#e24b4a" }}>
          <Trash2 size={14} style={{ marginRight: 4 }} /> Видалити назавжди
        </button>
      </div>

      <div style={P.disc}>
        <Shield size={14} style={{ color: "#475569", flexShrink: 0 }} />
        <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
          Результати ІІ мають допоміжний характер. Остаточний діагноз ставить лікар.
        </p>
      </div>
    </div>
  );
}
