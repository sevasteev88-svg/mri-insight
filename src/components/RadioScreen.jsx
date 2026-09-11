import { useState } from "react";
import { ArrowLeft, Search, ExternalLink } from "lucide-react";
import { ZONE_GROUPS } from "../constants/anatomy.js";
import { QUICK_TERMS } from "../constants/dictionaries.js";
import { translateTerm, radioUrl } from "../utils/helpers.js";
import { P } from "../styles/styles.js";

export default function RadioScreen({ setScr }) {
  const [q, setQ] = useState("");
  const translated = translateTerm(q);
  const doSearch = () => { if (q.trim()) window.open(radioUrl(q.trim()), "_blank"); };

  return (
    <div style={P.pg}>
      <div style={P.top}><button onClick={() => setScr("dash")} style={P.bk}><ArrowLeft size={16} /> Назад</button><h2 style={P.pT}>Radiopaedia</h2></div>

      <div style={{ background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.15)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <label style={{ ...P.lb, marginTop: 0 }}>Пошук на Radiopaedia</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Введіть термін українською або англійською" style={{ ...P.inp, flex: 1 }}
            onKeyDown={e => { if (e.key === "Enter") doSearch(); }} />
          <button onClick={doSearch}
            style={{ ...P.sm, padding: "8px 14px", background: "rgba(16,185,129,.15)", color: "#10b981", border: "1px solid rgba(16,185,129,.3)" }}>
            <Search size={16} />
          </button>
        </div>
        {q.trim().length > 0 && (
          <p style={{ fontSize: 11, marginTop: 5, color: translated ? "#10b981" : "#f59e0b" }}>
            {translated ? `→ "${translated}"` : `→ "${q.trim()}" (без перекладу, пошук як є)`}
          </p>
        )}
        {!q.trim() && <p style={{ fontSize: 10, color: "#475569", marginTop: 5 }}>Наприклад: "ПКС" → "ACL tear MRI", "грижа" → "disc herniation MRI"</p>}
      </div>

      <h3 style={P.secT}>Швидкий пошук</h3>
      <div style={{ marginBottom: 16 }}>
        {Object.entries(ZONE_GROUPS).map(([gk, gv]) => {
          const terms = gk === "joints" ? QUICK_TERMS.slice(0, 12) : gk === "spine" ? QUICK_TERMS.slice(12, 17) : gk === "head" ? QUICK_TERMS.slice(17, 20) : QUICK_TERMS.slice(20);
          if (terms.length === 0) return null;
          return <div key={gk} style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 4, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}><i className={`ti ${gv.icon}`} style={{ fontSize: 12 }} aria-hidden="true" /> {gv.label}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {terms.map((t, i) => <a key={i} href={`https://radiopaedia.org/search?q=${encodeURIComponent(t.en)}&scope=all`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#10b981", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.15)", borderRadius: 7, padding: "5px 10px", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                {t.ua} <ExternalLink size={9} />
              </a>)}
            </div>
          </div>;
        })}
      </div>

      <div style={{ background: "rgba(6,182,212,.06)", border: "1px solid rgba(6,182,212,.15)", borderRadius: 10, padding: 12 }}>
        <h4 style={{ fontSize: 12, fontWeight: 600, color: "#06b6d4", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>📋 Збереження зображень</h4>
        <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
          1. Знайдіть зображення на Radiopaedia<br/>
          2. Права кнопка → "Копіювати зображення"<br/>
          3. Перейдіть у <span style={{ color: "#a78bfa", cursor: "pointer" }} onClick={() => setScr("lib")}>Бібліотеку норми</span><br/>
          4. Ctrl+V — зображення додається до обраної зони
        </p>
      </div>
    </div>
  );
}