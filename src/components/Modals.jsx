import React from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { X, FileText, Clipboard, Save, Download, Brain } from "lucide-react";
import { ZONES } from "../constants/anatomy.js";
import { supabase } from "../services/supabase.js";

export function ReportModal() {
  const { showReport, setShowReport, reportLoading, reportText, setReportText, study, setStudy, flash } = React.useContext(AppContext);
  if (!showReport) return null;

  return (
    <div style={P.ov} onClick={() => setShowReport(false)}>
      <div style={{ ...P.pan, width: 800, maxWidth: "90%", height: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ ...P.panT, marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} color="#8b5cf6" /> Медичний протокол</h3>
          <button onClick={() => setShowReport(false)} style={{ background: "none", border: "none", color: "#8b919c", cursor: "pointer" }}><X size={18} /></button>
        </div>
        
        {reportLoading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}>
            <div style={P.pulse}><Brain size={32} /></div>
            <p style={{ marginTop: 16, fontSize: 13, color: "#94a3b8" }}>ШІ генерує протокол на основі ваших нотаток...</p>
          </div>
        ) : (
          <>
            <textarea 
              value={reportText} 
              onChange={e => setReportText(e.target.value)}
              style={{ flex: 1, background: "#13161c", border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, color: "#e8eaed", padding: 16, fontSize: 13, lineHeight: 1.6, fontFamily: "'IBM Plex Sans',sans-serif", resize: "none", outline: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button onClick={() => { navigator.clipboard.writeText(reportText); flash("Скопійовано в буфер"); }} style={{ ...P.sm, padding: "8px 16px", background: "#1a1d24", color: "#4aa3df", border: "1px solid rgba(74,163,223,.3)" }}>
                <Clipboard size={14} style={{ marginRight: 6 }} /> Скопіювати
              </button>
              <button onClick={async () => {
                if (!study) return;
                setStudy(p => ({ ...p, doctorReport: reportText }));
                try {
                  if (typeof study.id === "string" && study.id.length === 36) {
                    await supabase.from("studies").update({ ai_report: reportText, updated_at: new Date().toISOString() }).eq("id", study.id);
                  }
                  flash("Протокол збережено в картку пацієнта");
                } catch (e) {
                  console.error(e);
                  flash("Помилка збереження протоколу");
                }
              }} style={{ ...P.sm, padding: "8px 16px", background: "rgba(34,197,94,.15)", color: "#4ec99b", border: "1px solid rgba(34,197,94,.3)" }}>
                <Save size={14} style={{ marginRight: 6 }} /> Зберегти в картку
              </button>
              <button onClick={() => { 
                const blob = new Blob([reportText], {type: "text/plain;charset=utf-8"});
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `MRI_Protocol_${study?.patientName || "Unknown"}.txt`;
                a.click();
              }} style={{ ...P.pri, padding: "8px 16px", background: "#8b5cf6", border: "none" }}>
                <Download size={14} style={{ marginRight: 6 }} /> Завантажити .txt
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsModal() {
  const { showSet, setShowSet, apiKeyIn, setApiKeyIn, aiModel, setAiModel, saveKey } = React.useContext(AppContext);
  if (!showSet) return null;

  return (
    <div style={P.ov} onClick={() => setShowSet(false)}>
      <div style={P.pan} onClick={e => e.stopPropagation()}>
        <h3 style={P.panT}>Налаштування</h3>
        <label style={P.lb}>Gemini API Key</label>
        <input type="password" value={apiKeyIn} onChange={e => setApiKeyIn(e.target.value)} placeholder="AIza..." style={P.inp} />
        <p style={P.ht}>Отримайте на <span style={{ color: "#06b6d4" }}>ai.google.dev</span></p>
        <label style={{ ...P.lb, marginTop: 14 }}>Модель ІІ</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => { setAiModel("gemini-2.5-pro"); try { localStorage.setItem("mri-model", "gemini-2.5-pro"); } catch {} }} style={{ ...P.sm, padding: "10px 12px", textAlign: "left", justifyContent: "flex-start", background: aiModel === "gemini-2.5-pro" ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", border: aiModel === "gemini-2.5-pro" ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.07)" }}>
            <div><p style={{ fontSize: 13, fontWeight: 600, color: aiModel === "gemini-2.5-pro" ? "#06b6d4" : "#e2e8f0" }}>Gemini 2.5 Pro {aiModel === "gemini-2.5-pro" && "✓"}</p><p style={{ fontSize: 10, color: "#64748b" }}>Найвища точність · рекомендовано для діагностики</p></div>
          </button>
          <button onClick={() => { setAiModel("gemini-2.5-flash"); try { localStorage.setItem("mri-model", "gemini-2.5-flash"); } catch {} }} style={{ ...P.sm, padding: "10px 12px", textAlign: "left", justifyContent: "flex-start", background: aiModel === "gemini-2.5-flash" ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", border: aiModel === "gemini-2.5-flash" ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.07)" }}>
            <div><p style={{ fontSize: 13, fontWeight: 600, color: aiModel === "gemini-2.5-flash" ? "#06b6d4" : "#e2e8f0" }}>Gemini 2.5 Flash {aiModel === "gemini-2.5-flash" && "✓"}</p><p style={{ fontSize: 10, color: "#64748b" }}>Швидше та дешевше · для рутинного огляду</p></div>
          </button>
        </div>
        <button onClick={saveKey} style={{ ...P.pri, marginTop: 14 }}>Зберегти</button>
      </div>
    </div>
  );
}

export function ImageViewModal() {
  const { viewImg, setViewImg, setRefs } = React.useContext(AppContext);
  if (!viewImg) return null;

  return (
    <div style={P.ov} onClick={() => setViewImg(null)}>
      <div 
        style={{ 
          position: "relative", 
          maxWidth: "96vw", 
          maxHeight: "92vh", 
          background: "#13161c", 
          border: "1px solid rgba(255,255,255,.12)", 
          borderRadius: 12, 
          padding: 16, 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,.8)"
        }} 
        onClick={e => e.stopPropagation()}
      >
        <button onClick={() => setViewImg(null)} style={P.clX} title="Закрити"><X size={15} /></button>
        
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,.07)" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70vw" }}>
            {viewImg.name || "Перегляд зображення"}
          </span>
          <a 
            href={viewImg.data} 
            download={viewImg.name || "mri_image.png"} 
            target="_blank" 
            rel="noreferrer"
            style={{ fontSize: 11, color: "#4aa3df", display: "flex", alignItems: "center", gap: 4, textDecoration: "none", background: "rgba(74,163,223,.12)", padding: "4px 8px", borderRadius: 4 }}
          >
            Відкрити оригінал ↗
          </a>
        </div>

        <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#090b0e", borderRadius: 8, padding: 6, minWidth: 280, minHeight: 200, maxHeight: "72vh" }}>
          <img 
            src={viewImg.data} 
            alt={viewImg.name || ""} 
            style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 4, display: "block" }} 
          />
        </div>

        <input
          value={viewImg.caption || ""}
          onChange={e => {
            const cap = e.target.value;
            setViewImg(p => ({ ...p, caption: cap }));
            setRefs(p => {
              const updated = {};
              for (const [zone, imgs] of Object.entries(p)) {
                updated[zone] = (imgs || []).map(im => im.id === viewImg.id ? { ...im, caption: cap } : im);
              }
              return updated;
            });
          }}
          placeholder="Додати опис до знімка..."
          style={{ ...P.inp, marginTop: 10, maxWidth: 500, textAlign: "center", fontSize: 12, background: "rgba(255,255,255,.06)" }}
          onClick={e => e.stopPropagation()}
        />
        {viewImg.caption && <p style={{ fontSize: 10, color: "#10b981", marginTop: 4 }}>✓ Опис збережено</p>}
      </div>
    </div>
  );
}

export function RefPreviewModal() {
  const { showRefP, setShowRefP, study, refs, setViewImg } = React.useContext(AppContext);
  if (!showRefP) return null;

  return (
    <div style={P.ov} onClick={() => setShowRefP(false)}>
      <div style={P.refPan} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={P.panT}>Норма — {ZONES[study?.zone]?.ua}</h3>
          <button onClick={() => setShowRefP(false)} style={P.clX}><X size={14} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 6 }}>
          {(refs[study?.zone] || []).map((im, i) => (
            <div key={im.id} style={{ position: "relative", borderRadius: 6, overflow: "hidden", cursor: "pointer", border: "1px solid rgba(255,255,255,.07)" }} onClick={() => { setShowRefP(false); setViewImg(im); }}>
              <img src={im.data} alt="" style={{ width: "100%", display: "block" }} />
              <span style={P.thIdx}>{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
