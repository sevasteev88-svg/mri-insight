import React, { useState } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { Brain, Settings, AlertCircle, Plus, BookOpen, ExternalLink, Archive, Trash2, RotateCcw, Folder, User, X, ChevronRight, Cloud, CloudOff, RefreshCw, Lock, Search } from "lucide-react";
import { ZONES, ZONE_GROUPS } from "../constants/anatomy.js";
import { getModelBadge } from "../services/gemini.js";
import TI from "./TI.jsx";

export default function Dash() {
  const { 
    setScr, apiKey, aiModel, refs, atlas, kb, studies, 
    setShowSet, showArchive, setShowArchive, 
    newStudy, loadStudy, archiveStudy, unarchiveStudy, deleteStudy, askConfirm,
    archiveStatus, archiveLoading, archivePatients, archiveHandle, uploadProgress,
    unlinkArchive, linkArchive, restoreArchiveAccess, openPatientFromArchive,
    cloudSyncStatus, fetchCloudStudies, syncingCloud,
    setIsLocked
  } = React.useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "findings" | "normal" | "notes"

  return (
    <div style={P.pg}>
      <div style={P.hdr}>
        <div style={P.logo}>
          <span style={{ width: 30, height: 30, borderRadius: 6, background: "#15324a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={19} style={{ color: "#4aa3df" }} />
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#e8eaed" }}>MRI Insight</div>
            <p style={P.sub}>RADIOLOGY WORKSTATION</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button 
            onClick={fetchCloudStudies}
            disabled={syncingCloud}
            style={{ 
              fontSize: 11, 
              display: "flex", 
              alignItems: "center", 
              gap: 5, 
              background: cloudSyncStatus === "online" ? "rgba(34,197,94,.12)" : "rgba(224,169,59,.12)", 
              color: cloudSyncStatus === "online" ? "#4ec99b" : "#e0a93b", 
              border: `0.5px solid ${cloudSyncStatus === "online" ? "rgba(34,197,94,.3)" : "rgba(224,169,59,.3)"}`,
              padding: "4px 8px", 
              borderRadius: 4, 
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace" 
            }}
            title={syncingCloud ? "Оновлюється з хмари..." : "Натисніть для оновлення з хмари Supabase"}
          >
            {syncingCloud ? (
              <RefreshCw size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            ) : cloudSyncStatus === "online" ? (
              <Cloud size={13} />
            ) : (
              <CloudOff size={13} />
            )}
            {syncingCloud ? "СИНХРОНІЗАЦІЯ..." : cloudSyncStatus === "online" ? "CLOUD SYNC" : "LOCAL"}
          </button>
          <span style={{ fontSize: 11, color: "#4aa3df", background: "#15324a", padding: "4px 10px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>
            {getModelBadge(aiModel)}
          </span>
          <button onClick={() => setShowSet(true)} style={P.iBtn} title="Налаштування"><Settings size={18} /></button>
          <button onClick={() => setIsLocked(true)} style={{ ...P.iBtn, color: "#f87171", background: "rgba(239,68,68,.1)" }} title="Заблокувати робоче місце"><Lock size={17} /></button>
        </div>
      </div>

      <div style={P.body}>
        {!apiKey && (
          <div style={{ ...P.warn, margin: "0 0 14px" }}>
            <AlertCircle size={16} style={{ color: "#e0a93b", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: "#e0a93b" }}>API ключ не налаштовано</p>
              <p style={P.ws}>Налаштування → введіть ключ</p>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
          <button onClick={newStudy} className="mri-card-hover" style={P.act}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={18} style={{ color: "#4aa3df" }} />
              <span style={P.aLb}>Нове дослідження</span>
            </div>
            <span style={{ fontSize: 11, color: "#5f6672" }}>Завантажити серії пацієнта</span>
          </button>
          <button onClick={() => setScr("lib")} className="mri-card-hover" style={P.act}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={18} style={{ color: "#9b8cdb" }} />
              <span style={P.aLb}>Бібліотека</span>
            </div>
            <span style={{ fontSize: 11, color: "#5f6672" }}>Норми · атлас · база знань</span>
          </button>
          <button onClick={() => setScr("radio")} className="mri-card-hover" style={P.act}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ExternalLink size={18} style={{ color: "#4ec99b" }} />
              <span style={P.aLb}>Radiopaedia</span>
            </div>
            <span style={{ fontSize: 11, color: "#5f6672" }}>Довідник патологій</span>
          </button>
        </div>

        {/* Local PACS Archive */}
        <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, background: "#0f1217", padding: "16px", marginTop: 16, marginBottom: 16, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Folder size={18} color="#e0a93b" />
              <h2 style={{ fontSize: 16, fontWeight: 500, color: "#e8eaed" }}>Локальний Архів PACS</h2>
            </div>
            {archiveStatus === "ready" && (
              <button onClick={unlinkArchive} style={{ ...P.sm, padding: "4px 8px", color: "#e24b4a" }} title="Відв'язати"><X size={14} /></button>
            )}
          </div>

          {archiveLoading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#4aa3df", fontSize: 13, padding: "20px 0" }}>
              Завантаження пацієнта...{uploadProgress ? ` (${uploadProgress.done} / ${uploadProgress.total})` : ""}
            </div>
          ) : archiveStatus === "none" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "10px 0" }}>
              <p style={{ fontSize: 12, color: "#8b919c", marginBottom: 12 }}>Підключіть локальну папку (напр. D:\MRI_Archive).</p>
              <button onClick={linkArchive} style={{ ...P.btn, background: "rgba(224,169,59,.15)", color: "#e0a93b", border: "1px solid rgba(224,169,59,.3)", padding: "8px 16px" }}>🔗 Прив'язати папку архіву</button>
            </div>
          ) : archiveStatus === "prompt" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "10px 0" }}>
              <p style={{ fontSize: 12, color: "#e24b4a", marginBottom: 12 }}>Браузер вимагає підтвердження доступу після перезапуску.</p>
              <button onClick={restoreArchiveAccess} style={{ ...P.btn, background: "rgba(226,75,74,.15)", color: "#e24b4a", border: "1px solid rgba(226,75,74,.3)", padding: "8px 16px" }}>🔓 Надати доступ до {archiveHandle?.name || "архіву"}</button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
              {archivePatients.length === 0 ? (
                <p style={{ fontSize: 12, color: "#5f6672", gridColumn: "1/-1", textAlign: "center", padding: "20px 0" }}>Папка порожня.</p>
              ) : (
                archivePatients.map(p => (
                  <div key={p.name} onClick={() => openPatientFromArchive(p)} style={{ background: "#1a1d24", padding: "10px 12px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.03)" }}>
                    <User size={15} color="#8b919c" />
                    <span style={{ fontSize: 13, color: "#c4c9d0", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name.replace(/_/g, " ")}</span>
                    <ChevronRight size={14} color="#5f6672" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <p style={P.secT}>Бібліотека — покриття</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 18 }}>
          {Object.entries(ZONE_GROUPS).map(([gk, gv]) => {
            const total = Object.entries(ZONES).filter(([_, z]) => z.group === gk).reduce((s, [k]) => s + (refs[k] || []).length + (atlas[k] || []).length + (kb[k] || []).length, 0);
            return (
              <div key={gk} style={{ background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 6, padding: "10px 12px", cursor: "pointer" }} onClick={() => setScr("lib")}>
                <div style={{ fontSize: 11, color: "#8b919c", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                  <TI name={gv.icon} size={13} color="#5f6672" /> {gv.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "#4aa3df", fontFamily: "'JetBrains Mono',monospace" }}>{total}</div>
              </div>
            );
          })}
        </div>

        {/* Grouped patient studies list */}
        {(() => {
          const baseStudies = studies.filter(s => showArchive ? s.archived : !s.archived);
          const availableZones = Array.from(new Set(baseStudies.map(s => s.z).filter(Boolean)));
          const q = searchQuery.trim().toLowerCase();

          const filteredStudies = baseStudies.filter(s => {
            if (zoneFilter !== "all" && s.z !== zoneFilter) return false;
            if (statusFilter === "findings" && !(s.fc > 0)) return false;
            if (statusFilter === "normal" && (s.fc > 0)) return false;
            if (statusFilter === "notes" && !s.hasNotes) return false;
            if (q) {
              const pName = (s.pn || "Невідомий пацієнт").toLowerCase();
              const zName = (ZONES[s.z]?.ua || ZONES[s.z]?.short || s.z || "").toLowerCase();
              const dateStr = (s.mriDate || s.d || "").toLowerCase();
              if (!pName.includes(q) && !zName.includes(q) && !dateStr.includes(q)) return false;
            }
            return true;
          });
          
          const groupedByPatient = filteredStudies.reduce((acc, s) => {
            const name = (s.pn || "Невідомий пацієнт").trim();
            if (!acc[name]) acc[name] = [];
            acc[name].push(s);
            return acc;
          }, {});

          const sortedPatientNames = Object.keys(groupedByPatient).sort((a, b) => a.localeCompare(b));

          return (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <p style={{ ...P.secT, margin: 0 }}>
                    {showArchive ? "📁 Архів пацієнтів та травм" : "📋 Активні дослідження"}
                  </p>
                  <button 
                    onClick={fetchCloudStudies} 
                    disabled={syncingCloud} 
                    style={{ ...P.sm, padding: "3px 8px", fontSize: 11, color: "#4aa3df", background: "rgba(74,163,223,.1)", border: "0.5px solid rgba(74,163,223,.25)", display: "flex", alignItems: "center", gap: 4 }}
                    title="Синхронізувати з хмарою Supabase"
                  >
                    <RefreshCw size={11} style={{ animation: syncingCloud ? "spin 1s linear infinite" : "none" }} />
                    {syncingCloud ? "Оновлення..." : "Оновити"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button 
                    onClick={() => setShowArchive(false)} 
                    style={{ 
                      ...P.sm, 
                      padding: "6px 14px", 
                      fontSize: 12, 
                      background: !showArchive ? "#15324a" : "#1a1d24", 
                      color: !showArchive ? "#4aa3df" : "#8b919c", 
                      border: !showArchive ? "0.5px solid rgba(74,163,223,.4)" : "0.5px solid rgba(255,255,255,.08)" 
                    }}
                  >
                    <User size={13} style={{ marginRight: 4 }} /> Пацієнти ({studies.filter(s => !s.archived).length})
                  </button>
                  <button 
                    onClick={() => setShowArchive(true)} 
                    style={{ 
                      ...P.sm, 
                      padding: "6px 14px", 
                      fontSize: 12, 
                      background: showArchive ? "rgba(155,140,219,.14)" : "#1a1d24", 
                      color: showArchive ? "#9b8cdb" : "#8b919c", 
                      border: showArchive ? "0.5px solid rgba(155,140,219,.4)" : "0.5px solid rgba(255,255,255,.08)" 
                    }}
                  >
                    <Archive size={13} style={{ marginRight: 4 }} /> Архів ({studies.filter(s => s.archived).length})
                  </button>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              {baseStudies.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12, padding: "8px 10px", background: "#11141a", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8 }}>
                  <div style={{ position: "relative", flex: "1 1 210px", display: "flex", alignItems: "center" }}>
                    <Search size={14} color="#5f6672" style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Пошук за ПІБ, зоною або датою..."
                      style={{ ...P.inp, padding: "6px 28px 6px 30px", fontSize: 12, background: "#0c0e12" }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        style={{ position: "absolute", right: 6, background: "none", border: "none", color: "#8b919c", cursor: "pointer", padding: 2, display: "flex" }}
                        title="Очистити пошук"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <select
                    value={zoneFilter}
                    onChange={e => setZoneFilter(e.target.value)}
                    style={{ ...P.inp, width: "auto", minWidth: 145, padding: "6px 10px", fontSize: 12, background: "#0c0e12", cursor: "pointer" }}
                  >
                    <option value="all">Усі зони</option>
                    {availableZones.map(z => (
                      <option key={z} value={z}>{ZONES[z]?.short || ZONES[z]?.ua || z}</option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {[
                      ["all", "Усі"],
                      ["findings", "Зі знахідками"],
                      ["normal", "Норма"],
                      ["notes", "З нотатками"]
                    ].map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setStatusFilter(val)}
                        style={{
                          ...(statusFilter === val ? P.sqOn : P.sq),
                          padding: "5px 10px",
                          fontSize: 11
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sortedPatientNames.length === 0 ? (
                <p style={{ fontSize: 13, color: "#5f6672", textAlign: "center", padding: "20px 0" }}>
                  {baseStudies.length > 0
                    ? "За вибраними фільтрами нічого не знайдено."
                    : showArchive
                      ? "Архів порожній"
                      : "Немає активних досліджень. Створіть нове дослідження вище."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sortedPatientNames.map(pName => {
                    const pStudies = groupedByPatient[pName];
                    return (
                      <div key={pName} style={{ background: "#11141a", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(74,163,223,.12)", color: "#4aa3df", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <User size={15} />
                            </div>
                            <div>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{pName}</span>
                              <span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>{pStudies.length} {pStudies.length === 1 ? "дослідження" : "досліджень"}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {pStudies.map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => loadStudy(s.id)}
                              className="mri-card-hover"
                              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#161a22", border: "0.5px solid rgba(255,255,255,.05)", borderRadius: 8, padding: "9px 12px", cursor: "pointer" }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <i className="ti ti-scan" style={{ fontSize: 16, color: "#4aa3df" }} aria-hidden="true" />
                                <div>
                                  <p style={{ fontSize: 12, fontWeight: 500, color: "#e2e8f0", margin: 0 }}>
                                    {ZONES[s.z]?.ua || "МРТ"} · 📅 МРТ: <strong style={{ color: "#4aa3df" }}>{s.mriDate || s.d}</strong>
                                  </p>
                                  <p style={{ fontSize: 10, color: "#64748b", margin: "2px 0 0", fontFamily: "'JetBrains Mono',monospace" }}>
                                    {s.ic} зрізів {s.hasNotes && <span style={{ color: "#06b6d4", marginLeft: 6 }}>📝 з нотатками</span>}
                                  </p>
                                </div>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {s.fc > 0 ? <span style={P.bdLg}>{s.fc} ЗНАХІДОК</span> : <span style={P.bdOk}>НОРМА</span>}
                                {showArchive ? (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); unarchiveStudy(s.id); }} title="Відновити з архіву" style={{ ...P.sm, color: "#9b8cdb", padding: 4 }}><RotateCcw size={13} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); askConfirm({ title: "Видалити дослідження?", message: `Дослідження «${pName}» буде видалено назавжди.`, confirmLabel: "Видалити", danger: true, onConfirm: () => deleteStudy(s.id) }); }} title="Видалити назавжди" style={{ ...P.sm, color: "#e24b4a", padding: 4 }}><Trash2 size={13} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); archiveStudy(s.id); }} title="Перемістити в архів" style={{ ...P.sm, color: "#8b919c", padding: 4 }}><Archive size={13} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); askConfirm({ title: "Видалити дослідження?", message: `Дослідження «${pName}» буде видалено назавжди.`, confirmLabel: "Видалити", danger: true, onConfirm: () => deleteStudy(s.id) }); }} title="Видалити назавжди" style={{ ...P.sm, color: "#e24b4a", padding: 4 }}><Trash2 size={13} /></button>
                                  </>
                                )}
                                <ChevronRight size={14} style={{ color: "#5f6672" }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
