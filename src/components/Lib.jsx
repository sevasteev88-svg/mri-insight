import React from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { ArrowLeft, BookOpen, Upload, FileText, X, Plus, Trash2, Check } from "lucide-react";
import { ZONES } from "../constants/anatomy.js";
import ZoneGroups from "./ZoneGroups.jsx";

export default function Lib() {
  const {
    setScr, libTab, setLibTab, selZone, setSelZone,
    refs, setRefs, atlas, setAtlas, kb, setKb,
    refIn, pdfIn, atlasIn, pdfOk, uploadImgs, uploadPdf, flash,
    setViewImg, pdfM, setPdfM, rf, setRf, rt, setRt, addPdfPages
  } = React.useContext(AppContext);

  const imgs = refs[selZone] || [];
  const atlasImgs = atlas[selZone] || [];

  return (
    <div style={P.pg}>
      <div style={P.top}>
        <button onClick={() => setScr("dash")} style={P.bk}>
          <ArrowLeft size={16} /> Назад
        </button>
        <h2 style={P.pT}>Бібліотека</h2>
      </div>

      {/* Library tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button 
          onClick={() => setLibTab("refs")} 
          style={{ ...P.sm, padding: "8px 16px", fontSize: 12, background: libTab === "refs" ? "#15324a" : "#1a1d24", color: libTab === "refs" ? "#4aa3df" : "#8b919c", border: libTab === "refs" ? "0.5px solid rgba(74,163,223,.4)" : "0.5px solid rgba(255,255,255,.08)" }}
        >
          <BookOpen size={14} style={{ marginRight: 4 }} /> Референси норми
        </button>
        <button 
          onClick={() => setLibTab("atlas")} 
          style={{ ...P.sm, padding: "8px 16px", fontSize: 12, background: libTab === "atlas" ? "rgba(155,140,219,.14)" : "#1a1d24", color: libTab === "atlas" ? "#9b8cdb" : "#8b919c", border: libTab === "atlas" ? "0.5px solid rgba(155,140,219,.4)" : "0.5px solid rgba(255,255,255,.08)" }}
        >
          <i className="ti ti-book-2" style={{ fontSize: 14, marginRight: 4 }} aria-hidden="true" /> Анатомічний атлас ({Object.values(atlas).reduce((s, a) => s + a.length, 0)})
        </button>
        <button 
          onClick={() => setLibTab("kb")} 
          style={{ ...P.sm, padding: "8px 16px", fontSize: 12, background: libTab === "kb" ? "rgba(224,169,59,.14)" : "#1a1d24", color: libTab === "kb" ? "#e0a93b" : "#8b919c", border: libTab === "kb" ? "0.5px solid rgba(224,169,59,.4)" : "0.5px solid rgba(255,255,255,.08)" }}
        >
          <i className="ti ti-file-text" style={{ fontSize: 14, marginRight: 4 }} aria-hidden="true" /> База знань ({Object.values(kb).reduce((s, a) => s + a.length, 0)})
        </button>
      </div>

      <div style={P.ztabs}>
        <ZoneGroups 
          countFn={(k) => libTab === "refs" ? (refs[k] || []).length : libTab === "atlas" ? (atlas[k] || []).length : (kb[k] || []).length} 
          renderZone={(k, v) => {
            const cnt = libTab === "refs" ? (refs[k] || []).length : libTab === "atlas" ? (atlas[k] || []).length : (kb[k] || []).length;
            return (
              <button key={k} onClick={() => setSelZone(k)} style={selZone === k ? P.ztOn : P.zt}>
                {v.short}{cnt > 0 && <span style={P.ztB}>{cnt}</span>}
              </button>
            );
          }} 
        />
      </div>

      {libTab === "refs" ? (
        <>
          <div style={P.upRow}>
            <div style={P.upC} onClick={() => refIn.current?.click()}>
              <Upload size={20} style={{ color: "#06b6d4" }} />
              <span style={P.upL}>JPEG / DICOM</span>
              <input ref={refIn} type="file" multiple accept="image/*,.dcm,.dicom" style={{ display: "none" }} onChange={e => uploadImgs(e.target.files, "ref")} />
            </div>
            <div style={{ ...P.upC, opacity: pdfOk ? 1 : 0.4 }} onClick={() => pdfOk && pdfIn.current?.click()}>
              <FileText size={20} style={{ color: "#a78bfa" }} />
              <span style={P.upL}>PDF книга</span>
              <input ref={pdfIn} type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => e.target.files[0] && uploadPdf(e.target.files[0])} />
            </div>
            <div style={P.upC} onClick={() => flash("Скопіюйте зображення та натисніть Ctrl+V")}>
              <span style={{ fontSize: 20 }}>📋</span>
              <span style={P.upL}>Вставити</span>
            </div>
          </div>
          <p style={{ fontSize: 10, color: "#475569", marginTop: -8, marginBottom: 10, textAlign: "center" }}>
            Ctrl+V — вставити зображення з Radiopaedia або будь-якого сайту
          </p>

          {imgs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px" }}>
              <BookOpen size={32} style={{ color: "#1e293b" }} />
              <p style={{ fontSize: 13, color: "#475569", marginTop: 10 }}>Завантажте знімки норми з книг</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{imgs.length} реф. — "{ZONES[selZone]?.ua}"</p>
              <div style={P.iGrid}>
                {imgs.map((im, i) => (
                  <div key={im.id} style={P.thBox}>
                    <img src={im.data} alt="" style={P.th} onClick={() => setViewImg(im)} />
                    <button onClick={() => setRefs(p => ({ ...p, [selZone]: p[selZone].filter(x => x.id !== im.id) }))} style={P.thDel}><X size={10} /></button>
                    <span style={P.thIdx}>{i + 1}</span>
                    {im.pg && <span style={P.thPg}>с.{im.pg}</span>}
                    {im.src === "clipboard" && !im.pg && <span style={P.thClip}>📋</span>}
                    {im.caption && <div style={P.thCap}>{im.caption}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : libTab === "atlas" ? (
        <>
          <div style={{ background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.12)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#a78bfa", lineHeight: 1.5 }}>
              📖 Завантажте підписані зображення анатомії з книг або атласів. Кожне зображення повинно мати опис — яка структура зображена. ІІ використовуватиме ці зображення при аналізі ROI для точнішої ідентифікації структур.
            </p>
          </div>
          <div style={P.upRow}>
            <div style={P.upC} onClick={() => atlasIn.current?.click()}>
              <Upload size={20} style={{ color: "#a78bfa" }} />
              <span style={P.upL}>Додати зображення</span>
              <input ref={atlasIn} type="file" multiple accept="image/*,.dcm,.dicom" style={{ display: "none" }} onChange={async (e) => {
                const files = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
                for (const f of files) {
                  const d = await new Promise(r => { const fr = new FileReader(); fr.onload = ev => r(ev.target.result); fr.readAsDataURL(f); });
                  const label = prompt(`Опис для "${f.name}":\nНаприклад: "ПКС на сагітальному зрізі, T2" або "Медіальний меніск, коронарна площина"`);
                  if (label && label.trim()) {
                    setAtlas(p => ({ ...p, [selZone]: [...(p[selZone] || []), { id: Date.now() + Math.random(), name: f.name, data: d, label: label.trim(), ts: Date.now() }] }));
                  }
                }
                flash(`Додано до атласу`);
              }} />
            </div>
          </div>
          {atlasImgs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px" }}>
              <span style={{ fontSize: 32 }}>📖</span>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 10 }}>Додайте підписані зображення анатомії</p>
              <p style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Сторінки з атласу, схеми, підписані МРТ</p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#a78bfa", marginBottom: 6 }}>{atlasImgs.length} зображень атласу — "{ZONES[selZone]?.ua}"</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                {atlasImgs.map((im) => (
                  <div key={im.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.12)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                    <img src={im.data} alt="" style={{ width: "100%", display: "block", cursor: "pointer" }} onClick={() => setViewImg(im)} />
                    <div style={{ padding: "6px 8px", background: "rgba(139,92,246,.06)" }}>
                      <p style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, lineHeight: 1.3 }}>{im.label}</p>
                    </div>
                    <button 
                      onClick={() => setAtlas(p => ({ ...p, [selZone]: (p[selZone] || []).filter(x => x.id !== im.id) }))}
                      style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.7)", border: "none", borderRadius: 4, padding: 2, color: "#ef4444", cursor: "pointer" }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* KNOWLEDGE BASE TAB */}
          <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.12)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.5 }}>
              📝 Додайте текстові правила інтерпретації МРТ для кожної зони. Наприклад: "На T2 ПКС має бути низького сигналу. Якщо сигнал підвищений та зв'язка потовщена — підозра на часткове пошкодження." ІІ використовуватиме ці правила при аналізі знімків.
            </p>
          </div>
          <button onClick={() => {
            const title = prompt("Назва правила:\nНаприклад: 'ПКС — ознаки пошкодження' або 'Меніск — критерії розриву'");
            if (!title || !title.trim()) return;
            const text = prompt(`Текст правила для "${title.trim()}":\nОпишіть як виглядає патологія на МРТ, які послідовності найкраще показують, на що звертати увагу.`);
            if (!text || !text.trim()) return;
            setKb(p => ({ ...p, [selZone]: [...(p[selZone] || []), { id: Date.now(), title: title.trim(), text: text.trim() }] }));
            flash("Правило додано");
          }} style={{ ...P.sm, padding: "10px 16px", fontSize: 12, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", color: "#f59e0b", marginBottom: 12, width: "100%", justifyContent: "center" }}>
            <Plus size={14} style={{ marginRight: 4 }} /> Додати правило для "{ZONES[selZone]?.short}"
          </button>
          {(kb[selZone] || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px" }}>
              <span style={{ fontSize: 32 }}>📝</span>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 10 }}>Немає правил для цієї зони</p>
              <p style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Додайте діагностичні критерії з відео, книг або власного досвіду</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 8 }}>{(kb[selZone] || []).length} правил — "{ZONES[selZone]?.ua}"</p>
              {(kb[selZone] || []).map(entry => (
                <div key={entry.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: 12, marginBottom: 8, position: "relative" }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 6 }}>{entry.title}</h4>
                  <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.text}</p>
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    <button onClick={() => {
                      const newText = prompt("Редагувати текст правила:", entry.text);
                      if (newText && newText.trim()) setKb(p => ({ ...p, [selZone]: (p[selZone] || []).map(e => e.id === entry.id ? { ...e, text: newText.trim() } : e) }));
                    }} style={{ ...P.sm, fontSize: 11, color: "#06b6d4" }}>Редагувати</button>
                    <button onClick={() => {
                      setKb(p => ({ ...p, [selZone]: (p[selZone] || []).filter(e => e.id !== entry.id) }));
                      flash("Правило видалено");
                    }} style={{ ...P.sm, fontSize: 11, color: "#ef4444" }}><Trash2 size={11} /> Видалити</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PDF Modal */}
      {pdfM && (
        <div style={P.ov} onClick={() => !pdfM.ld && setPdfM(null)}>
          <div style={P.pdfPan} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <h3 style={P.panT}>{pdfM.nm}</h3>
                <p style={P.ht}>{pdfM.tot} стор. · Обрано: {pdfM.sel.size}</p>
              </div>
              {!pdfM.ld && <button onClick={() => setPdfM(null)} style={P.clX}><X size={14} /></button>}
            </div>
            {pdfM.ld && (
              <div style={{ padding: "14px 0" }}>
                <div style={P.prB}><div style={{ ...P.prF, width: `${pdfM.pr}%` }} /></div>
                <p style={P.prT}>{pdfM.pr < 100 ? `Завантаження... ${pdfM.pr}%` : "Рендеринг..."}</p>
              </div>
            )}
            {!pdfM.ld && pdfM.th.length > 0 && (
              <>
                <div style={P.pdfCtrl}>
                  <button onClick={() => setPdfM(p => ({ ...p, sel: new Set(Array.from({ length: p.tot }, (_, i) => i + 1)) }))} style={P.sm}>Обрати все</button>
                  <button onClick={() => setPdfM(p => ({ ...p, sel: new Set() }))} style={P.sm}>Скинути</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                    <input value={rf} onChange={e => setRf(e.target.value)} placeholder="від" style={P.rIn} />
                    <span style={{ color: "#475569" }}>—</span>
                    <input value={rt} onChange={e => setRt(e.target.value)} placeholder="до" style={P.rIn} />
                    <button onClick={() => { const a = +rf, b = +rt; if (a && b && a <= b && a >= 1 && b <= pdfM.tot) setPdfM(p => { const s = new Set(p.sel); for (let i = a; i <= b; i++) s.add(i); return { ...p, sel: s }; }); }} style={P.sm}>OK</button>
                  </div>
                </div>
                <div style={P.pdfG}>
                  {pdfM.th.map(t => (
                    <div key={t.p} onClick={() => setPdfM(p => { const s = new Set(p.sel); s.has(t.p) ? s.delete(t.p) : s.add(t.p); return { ...p, sel: s }; })} style={{ ...P.pdfTh, border: pdfM.sel.has(t.p) ? "2px solid #06b6d4" : "2px solid transparent" }}>
                      <img src={t.d} alt="" style={{ width: "100%", display: "block", borderRadius: 4 }} />
                      {pdfM.sel.has(t.p) && <div style={P.pdfCh}><Check size={10} /></div>}
                      <span style={P.pdfN}>{t.p}</span>
                    </div>
                  ))}
                </div>
                <button onClick={addPdfPages} disabled={pdfM.sel.size === 0} style={{ ...P.pri, opacity: pdfM.sel.size === 0 ? 0.4 : 1 }}>
                  Додати {pdfM.sel.size} стор. → "{ZONES[selZone]?.short}"
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
