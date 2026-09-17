import React from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { ArrowLeft, Folder, Upload, Columns, FileText, EyeOff, Eye, X, Mic, Square, Volume2 } from "lucide-react";
import { CAPTURE_GROUPS, CAPTURE_ZONES, SEQUENCES, PLANES, PLANE_LABELS, ZONES, parseSeriesKey } from "../constants/anatomy.js";
import { dbPut } from "../services/db.js";

export default function NewStudy() {
  const {
    study, setStudy, setScr, setPrevScr, curImgs, totalCount,
    seriesKey, anon, setAnon, folderIn, patIn, uploadImgs,
    vnotes, recording, startVoice, stopVoice, setStudies, studies
  } = React.useContext(AppContext);

  const ci = curImgs();
  const tc = totalCount();

  return (
    <div style={P.pg}>
      <div style={P.top}>
        <button onClick={() => { setVnotes({}); setScr("dash"); }} style={P.bk}>
          <ArrowLeft size={16} /> Назад
        </button>
        <h2 style={P.pT}>Нове дослідження</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={P.lb}>Пацієнт (ПІБ)</label>
          <input 
            value={study?.patientName || ""} 
            onChange={e => setStudy(p => ({ ...p, patientName: e.target.value }))} 
            placeholder="ПІБ або ID" 
            style={P.inp} 
          />
        </div>
        <div>
          <label style={P.lb}>Дата МРТ сканування (з DICOM)</label>
          <input 
            value={study?.date || ""} 
            onChange={e => setStudy(p => ({ ...p, date: e.target.value }))} 
            placeholder="Автоматично з DICOM (напр. 17.11.2025)" 
            style={P.inp} 
          />
        </div>
      </div>

      <label style={P.lb}>Клінічний контекст (підвищує точність ІІ)</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
        <div>
          <input value={study?.age || ""} onChange={e => setStudy(p => ({ ...p, age: e.target.value }))} placeholder="Вік (напр. 35 р.)" style={P.inp} />
        </div>
        <div>
          <input value={study?.birthDate || ""} onChange={e => setStudy(p => ({ ...p, birthDate: e.target.value }))} placeholder="Дата народження" style={P.inp} />
        </div>
        <div>
          <input value={study?.sex || ""} onChange={e => setStudy(p => ({ ...p, sex: e.target.value }))} placeholder="Стать (M/F)" style={P.inp} />
        </div>
      </div>
      <input 
        value={study?.complaints || ""} 
        onChange={e => setStudy(p => ({ ...p, complaints: e.target.value }))} 
        placeholder="Скарги (напр. біль у коліні при згинанні, блокада)" 
        style={{ ...P.inp, marginBottom: 6 }} 
      />
      <input 
        value={study?.mechanism || ""} 
        onChange={e => setStudy(p => ({ ...p, mechanism: e.target.value }))} 
        placeholder="Механізм травми / анамнез (напр. падіння на лижах 2 тижні тому)" 
        style={P.inp} 
      />

      <div style={{ marginBottom: 12 }}>
        <label style={P.lb}>Зона дослідження</label>
        <select 
          value={study?.zone || "knee"} 
          onChange={e => setStudy(p => ({ ...p, zone: e.target.value }))}
          style={{ ...P.inp, background: "#13161c", border: "1px solid rgba(74,163,223,.3)", color: "#4aa3df", fontWeight: 600, fontSize: 13, cursor: "pointer", outline: "none" }}
        >
          {Object.entries(CAPTURE_GROUPS).map(([gk, gv]) => (
            <optgroup key={gk} label={`— ${gv.label} —`}>
              {gv.zones.map(k => (
                <option key={k} value={k}>
                  {CAPTURE_ZONES[k]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <label style={P.lb}>Послідовність</label>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
        {SEQUENCES.map(s => (
          <button 
            key={s} 
            onClick={() => setStudy(p => ({ ...p, activeSeq: s }))}
            style={study?.activeSeq === s ? P.sqOn : P.sq}
          >
            {s}
          </button>
        ))}
      </div>

      <label style={P.lb}>Площина</label>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {PLANES.map(pl => (
          <button 
            key={pl} 
            onClick={() => setStudy(p => ({ ...p, activePlane: pl }))}
            style={study?.activePlane === pl ? P.sqOn : P.sq}
          >
            {PLANE_LABELS[pl]} ({pl})
          </button>
        ))}
      </div>

      {/* Multi-zone notification & tabs if patient has scans for more than one anatomical area */}
      {study?.zones && study.zones.length > 1 && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(139,92,246,.1)", borderRadius: 8, border: "1px solid rgba(139,92,246,.25)" }}>
          <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600, marginBottom: 6 }}>
            Виявлено кілька анатомічних зон у дослідженні:
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {study.zones.map(z => {
              const isActiveZone = study.zone === z;
              return (
                <button
                  key={z}
                  onClick={() => {
                    // Switch to first available series of this zone
                    const firstSeriesOfZone = Object.keys(study.series || {}).find(k => k.startsWith(z + "__") && study.series[k]?.length > 0);
                    if (firstSeriesOfZone) {
                      const { seq, plane } = parseSeriesKey(firstSeriesOfZone, z);
                      setStudy(p => ({ ...p, zone: z, activeSeq: seq, activePlane: plane, activeSeriesKey: firstSeriesOfZone }));
                    } else {
                      setStudy(p => ({ ...p, zone: z }));
                    }
                  }}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: isActiveZone ? "#8b5cf6" : "rgba(255,255,255,.05)",
                    color: isActiveZone ? "#fff" : "#a78bfa",
                    border: isActiveZone ? "1px solid #a78bfa" : "1px solid rgba(139,92,246,.2)",
                    fontWeight: 600
                  }}
                >
                  {ZONES[z]?.ua || z}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: "rgba(6,182,212,.06)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#06b6d4", fontWeight: 600 }}>
        Активна серія: {study?.zones?.length > 1 && study.zone && ZONES[study.zone] ? `[${ZONES[study.zone].short || ZONES[study.zone].ua}] ` : ""}{study?.activeSeq} · {PLANE_LABELS[study?.activePlane]} — {ci.length} зрізів
      </div>

      {/* Series summary */}
      {tc > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.entries(study.series || {}).filter(([_, a]) => a.length > 0).map(([s, a]) => {
            const { zone: sZone, seq, plane } = parseSeriesKey(s, study?.zone);
            const isMultiZone = (study?.zones && study.zones.length > 1);
            const isSelected = (s === seriesKey() || s === study?.activeSeriesKey);
            const zoneTag = isMultiZone && sZone && ZONES[sZone] ? `[${ZONES[sZone].short}] ` : "";

            return (
              <button 
                key={s} 
                onClick={() => { 
                  setStudy(p => ({ 
                    ...p, 
                    zone: sZone || p.zone, 
                    activeSeq: seq, 
                    activePlane: plane,
                    activeSeriesKey: s 
                  })); 
                }}
                style={{ 
                  fontSize: 11, 
                  background: isSelected ? "rgba(6,182,212,.15)" : "rgba(255,255,255,.04)", 
                  border: isSelected ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.06)", 
                  borderRadius: 6, 
                  padding: "4px 9px", 
                  color: isSelected ? "#06b6d4" : "#94a3b8", 
                  cursor: "pointer",
                  fontWeight: isSelected ? 600 : 400
                }}
              >
                {zoneTag}{seq} {plane}: {a.length}
              </button>
            );
          })}
          <div style={{ fontSize: 11, background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "4px 9px", color: "#94a3b8" }}>
            Разом: {tc}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 10, padding: "9px 12px", background: "rgba(255,255,255,.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,.06)" }}>
        <button 
          onClick={() => { setAnon(!anon); try { localStorage.setItem("mri-an", (!anon).toString()); } catch {} }}
          style={{ ...P.sm, background: anon ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", color: anon ? "#06b6d4" : "#64748b", border: anon ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.08)" }}
        >
          {anon ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: anon ? "#06b6d4" : "#64748b" }}>Анонімізація {anon ? "увімкнена" : "вимкнена"}</p>
          <p style={{ fontSize: 10, color: "#475569" }}>Обрізка країв та приховування даних</p>
        </div>
      </div>

      <label style={P.lb}>Завантаження знімків ({tc} зрізів у всіх серіях)</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {/* Folder upload - like RadiAnt */}
        <div 
          style={{ ...P.drop, padding: "16px 12px", border: "1.5px dashed rgba(74,163,223,.4)", background: "rgba(74,163,223,.05)", cursor: "pointer" }} 
          onClick={() => folderIn.current?.click()}
          title="Завантажити всю папку пацієнта з диска або флешки (з усіма підпапками та серіями)"
        >
          <Folder size={26} style={{ color: "#4aa3df" }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "#4aa3df", margin: "6px 0 2px" }}>Завантажити ВСЮ папку МРТ</p>
          <span style={{ fontSize: 10, color: "#8b919c" }}>Автоматично завантажує всі 300+ зрізів з усіх підпапок</span>
          <input 
            ref={folderIn} 
            type="file" 
            webkitdirectory="" 
            directory="" 
            multiple 
            style={{ display: "none" }} 
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                uploadImgs(e.target.files, "patient");
              }
              e.target.value = "";
            }} 
          />
        </div>

        {/* Individual files drop */}
        <div 
          style={{ ...P.drop, padding: "16px 12px" }} 
          onClick={() => patIn.current?.click()} 
          onDragOver={e => e.preventDefault()} 
          onDrop={e => { e.preventDefault(); uploadImgs(e.dataTransfer.files, "patient"); }}
        >
          <Upload size={26} style={{ color: "#8b919c" }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", margin: "6px 0 2px" }}>Окремі файли або Drag & Drop</p>
          <span style={{ fontSize: 10, color: "#64748b" }}>Перетягніть файли або виберіть кілька DICOM</span>
          <input 
            ref={patIn} 
            type="file" 
            multiple 
            accept="*/*" 
            style={{ display: "none" }} 
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                uploadImgs(e.target.files, "patient");
              }
              e.target.value = "";
            }} 
          />
        </div>
      </div>

      {ci.length > 0 && (
        <>
          <div style={P.iGrid}>
            {ci.map((im, i) => (
              <div key={im.id} style={P.thBox}>
                <img src={im.data} alt="" style={P.th} />
                <button 
                  onClick={() => { 
                    const k = seriesKey(); 
                    setStudy(p => ({ ...p, series: { ...p.series, [k]: p.series[k].filter(x => x.id !== im.id) } })); 
                  }} 
                  style={P.thDel}
                >
                  <X size={10} />
                </button>
                <span style={P.thIdx}>{i + 1}</span>
                {vnotes[`${seriesKey()}-${i}`] && <span style={P.vDot}><Mic size={7} /></span>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={P.lb}>Голосові нотатки ({study?.activeSeq} {study?.activePlane})</label>
            <p style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Оберіть зріз та диктуйте</p>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
              {ci.slice(0, 24).map((_, i) => {
                const noteKey = `${seriesKey()}-${i}`;
                return (
                  <button 
                    key={i} 
                    onClick={() => recording === noteKey ? stopVoice() : startVoice(noteKey)}
                    style={{ ...P.sm, minWidth: 32, background: recording === noteKey ? "rgba(239,68,68,.18)" : vnotes[noteKey] ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", color: recording === noteKey ? "#ef4444" : vnotes[noteKey] ? "#06b6d4" : "#64748b", border: recording === noteKey ? "1px solid rgba(239,68,68,.3)" : "1px solid rgba(255,255,255,.07)" }}
                  >
                    {recording === noteKey ? <Square size={9} /> : vnotes[noteKey] ? <Volume2 size={9} /> : i + 1}
                  </button>
                );
              })}
            </div>
            {recording !== null && <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}><Mic size={11} /> Запис...</p>}
            {Object.entries(vnotes).filter(([k, v]) => k.startsWith(seriesKey()) && v.trim()).map(([k, v]) => (
              <div key={k} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                <span style={{ color: "#06b6d4", fontWeight: 600 }}>{k}:</span> {v.trim()}
              </div>
            ))}
          </div>
        </>
      )}

      {tc > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button 
            onClick={async () => {
              const fullToSave = { 
                ...study, 
                vnotes: { ...vnotes, ...(study.vnotes || {}) },
                status: study.findings?.length > 0 ? "done" : "draft" 
              };
              setStudy(fullToSave);
              try {
                await dbPut("studies", String(study.id), fullToSave);
                const fc = (study.findings || []).length;
                const meta = { id: study.id, pn: study.patientName, z: study.zone, d: study.date || new Date().toLocaleDateString("uk-UA"), mriDate: study.mriDate || study.date, ic: tc, fc, archived: false, hasNotes: Object.keys(vnotes || {}).length > 0 };
                setStudies(p => [meta, ...(p || []).filter(x => x.id !== study.id)]);
                try { localStorage.setItem("mri-hist", JSON.stringify([meta, ...(studies || []).filter(x => x.id !== study.id)])); } catch {}
              } catch {}
              setPrevScr("new");
              setScr("split");
            }} 
            style={{ ...P.pri, flex: "2 1 220px", padding: "12px 20px", background: "#1d6ea8", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Columns size={18} /> Переглянути зрізи у Split-Screen ({tc} зрізів)
          </button>
          <button 
            onClick={async () => {
              const fullToSave = { 
                ...study, 
                vnotes: { ...vnotes, ...(study.vnotes || {}) },
                status: "draft" 
              };
              setStudy(fullToSave);
              try {
                await dbPut("studies", String(study.id), fullToSave);
                const meta = { id: study.id, pn: study.patientName, z: study.zone, d: study.date || new Date().toLocaleDateString("uk-UA"), mriDate: study.mriDate || study.date, ic: tc, fc: 0, archived: false, hasNotes: Object.keys(vnotes || {}).length > 0 };
                setStudies(p => [meta, ...(p || []).filter(x => x.id !== study.id)]);
                try { localStorage.setItem("mri-hist", JSON.stringify([meta, ...(studies || []).filter(x => x.id !== study.id)])); } catch {}
              } catch {}
              setScr("results");
            }} 
            style={{ ...P.sm, flex: "1 1 140px", padding: "12px 16px", background: "#1a1d24", color: "#e2e8f0", border: "1px solid rgba(255,255,255,.1)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <FileText size={16} /> Картка дослідження
          </button>
        </div>
      )}
    </div>
  );
}
