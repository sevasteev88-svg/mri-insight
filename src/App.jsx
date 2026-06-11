import { useState, useRef, useEffect, useCallback } from "react";
import {
  Settings, Upload, Plus, ArrowLeft, X, Zap, Shield, Brain, BookOpen,
  Eye, ChevronRight, AlertCircle, CheckCircle, Mic, MicOff, Search,
  EyeOff, Columns, FileText, Check, ExternalLink, ChevronLeft,
  Volume2, Square, Info, Archive, Trash2, RotateCcw, Paperclip, Crosshair
} from "lucide-react";

// ═══════════ IndexedDB HELPERS ═══════════
const DB_NAME = "mri-insight-db";
const DB_VER = 4;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("refs")) db.createObjectStore("refs");
      if (!db.objectStoreNames.contains("studies")) db.createObjectStore("studies");
      if (!db.objectStoreNames.contains("corrections")) db.createObjectStore("corrections");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function dbPut(store, key, value) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    const reqK = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => { reqK.onsuccess = () => { const obj = {}; reqK.result.forEach((k, i) => { obj[k] = req.result[i]; }); resolve(obj); }; };
    req.onerror = () => resolve({});
  });
}

const ZONES = {
  knee: { ua: "Колінний суглоб", short: "Коліно", en: "knee", group: "joints" },
  hip: { ua: "Кульшовий суглоб", short: "Кульшовий", en: "hip", group: "joints" },
  ankle: { ua: "Гомілковостопний суглоб", short: "Гомілковостоп", en: "ankle", group: "joints" },
  shoulder: { ua: "Плечовий суглоб", short: "Плечовий", en: "shoulder", group: "joints" },
  elbow: { ua: "Ліктьовий суглоб", short: "Ліктьовий", en: "elbow", group: "joints" },
  wrist: { ua: "Променезап'ястковий суглоб", short: "Зап'ястковий", en: "wrist", group: "joints" },
  hand: { ua: "Кисть", short: "Кисть", en: "hand", group: "joints" },
  foot: { ua: "Стопа", short: "Стопа", en: "foot", group: "joints" },
  c_spine: { ua: "Шийний відділ хребта", short: "Шийний", en: "cervical spine", group: "spine" },
  t_spine: { ua: "Грудний відділ хребта", short: "Грудний", en: "thoracic spine", group: "spine" },
  l_spine: { ua: "Поперековий відділ хребта", short: "Поперековий", en: "lumbar spine", group: "spine" },
  head: { ua: "Голова (головний мозок)", short: "Голова", en: "brain head", group: "head" },

  // М'язи стегна — передня група
  m_rectus_femoris: { ua: "Прямий м'яз стегна", short: "Прямий", en: "rectus femoris", group: "muscles", sub: "thigh_ant" },
  m_vastus_lat: { ua: "Латеральний широкий м'яз", short: "Лат. широкий", en: "vastus lateralis", group: "muscles", sub: "thigh_ant" },
  m_vastus_med: { ua: "Медіальний широкий м'яз", short: "Мед. широкий", en: "vastus medialis", group: "muscles", sub: "thigh_ant" },
  m_vastus_int: { ua: "Проміжний широкий м'яз", short: "Пром. широкий", en: "vastus intermedius", group: "muscles", sub: "thigh_ant" },
  // М'язи стегна — задня група
  m_biceps_fem: { ua: "Двоголовий м'яз стегна", short: "Двоголовий", en: "biceps femoris", group: "muscles", sub: "thigh_post" },
  m_semitend: { ua: "Напівсухожилковий м'яз", short: "Напівсухожилк.", en: "semitendinosus", group: "muscles", sub: "thigh_post" },
  m_semimemb: { ua: "Напівперетинчастий м'яз", short: "Напівперетинч.", en: "semimembranosus", group: "muscles", sub: "thigh_post" },
  // М'язи стегна — медіальна група
  m_adductor_long: { ua: "Довгий привідний м'яз", short: "Довгий прив.", en: "adductor longus", group: "muscles", sub: "thigh_med" },
  m_adductor_mag: { ua: "Великий привідний м'яз", short: "Великий прив.", en: "adductor magnus", group: "muscles", sub: "thigh_med" },
  m_gracilis: { ua: "Тонкий м'яз", short: "Тонкий", en: "gracilis", group: "muscles", sub: "thigh_med" },
  m_pectineus: { ua: "Гребінчастий м'яз", short: "Гребінчастий", en: "pectineus", group: "muscles", sub: "thigh_med" },
  // М'язи гомілки — задня група
  m_gastroc: { ua: "Литковий м'яз", short: "Литковий", en: "gastrocnemius", group: "muscles", sub: "calf_post" },
  m_soleus: { ua: "Камбалоподібний м'яз", short: "Камбалопод.", en: "soleus", group: "muscles", sub: "calf_post" },
  m_tib_post: { ua: "Задній великогомілковий м'яз", short: "Задній в/гом.", en: "tibialis posterior", group: "muscles", sub: "calf_post" },
  m_flex_dig: { ua: "Довгий згинач пальців", short: "Згинач пальців", en: "flexor digitorum longus", group: "muscles", sub: "calf_post" },
  // М'язи гомілки — передня/латеральна
  m_tib_ant: { ua: "Передній великогомілковий м'яз", short: "Передній в/гом.", en: "tibialis anterior", group: "muscles", sub: "calf_ant" },
  m_ext_dig: { ua: "Довгий розгинач пальців", short: "Розгинач пальців", en: "extensor digitorum longus", group: "muscles", sub: "calf_ant" },
  m_peroneus: { ua: "Малогомілкові м'язи", short: "Малогомілкові", en: "peroneus", group: "muscles", sub: "calf_lat" },
  // М'язи плеча
  m_biceps_br: { ua: "Двоголовий м'яз плеча", short: "Двоголовий", en: "biceps brachii", group: "muscles", sub: "arm" },
  m_brachialis: { ua: "Плечовий м'яз", short: "Плечовий", en: "brachialis", group: "muscles", sub: "arm" },
  m_triceps: { ua: "Триголовий м'яз плеча", short: "Триголовий", en: "triceps brachii", group: "muscles", sub: "arm" },
  // Ротаторна манжета
  m_supraspin: { ua: "Надостьовий м'яз", short: "Надостьовий", en: "supraspinatus", group: "muscles", sub: "rotator" },
  m_infraspin: { ua: "Підостьовий м'яз", short: "Підостьовий", en: "infraspinatus", group: "muscles", sub: "rotator" },
  m_teres_min: { ua: "Малий круглий м'яз", short: "Малий круглий", en: "teres minor", group: "muscles", sub: "rotator" },
  m_subscap: { ua: "Підлопатковий м'яз", short: "Підлопатковий", en: "subscapularis", group: "muscles", sub: "rotator" },

  // Зв'язки коліна
  l_acl: { ua: "Передня хрестоподібна зв'язка", short: "ПХЗ", en: "anterior cruciate ligament", group: "ligaments", sub: "knee_lig" },
  l_pcl: { ua: "Задня хрестоподібна зв'язка", short: "ЗХЗ", en: "posterior cruciate ligament", group: "ligaments", sub: "knee_lig" },
  l_mcl: { ua: "Медіальна колатеральна зв'язка", short: "МКЗ", en: "medial collateral ligament", group: "ligaments", sub: "knee_lig" },
  l_lcl: { ua: "Латеральна колатеральна зв'язка", short: "ЛКЗ", en: "lateral collateral ligament", group: "ligaments", sub: "knee_lig" },
  l_patellar: { ua: "Зв'язка наколінка", short: "Наколінок", en: "patellar ligament", group: "ligaments", sub: "knee_lig" },
  // Зв'язки/сухожилля гомілковостопу
  l_achilles: { ua: "Ахіллове сухожилля", short: "Ахілл", en: "achilles tendon", group: "ligaments", sub: "ankle_lig" },
  l_deltoid: { ua: "Дельтоподібна зв'язка", short: "Дельтоподібна", en: "deltoid ligament", group: "ligaments", sub: "ankle_lig" },
  l_atfl: { ua: "Передня таранно-малогомілкова зв'язка", short: "ПТМЗ", en: "anterior talofibular ligament", group: "ligaments", sub: "ankle_lig" },
  l_cfl: { ua: "П'ятково-малогомілкова зв'язка", short: "ПМЗ", en: "calcaneofibular ligament", group: "ligaments", sub: "ankle_lig" },
};

const SUBGROUPS = {
  thigh_ant: "Стегно — передня група",
  thigh_post: "Стегно — задня група",
  thigh_med: "Стегно — медіальна група",
  calf_post: "Гомілка — задня група",
  calf_ant: "Гомілка — передня група",
  calf_lat: "Гомілка — латеральна група",
  arm: "Плече",
  rotator: "Ротаторна манжета",
  knee_lig: "Зв'язки коліна",
  ankle_lig: "Зв'язки/сухожилля гомілковостопу",
};

const ZONE_GROUPS = {
  joints: { label: "Суглоби", icon: "ti-bone" },
  spine: { label: "Хребет", icon: "ti-spine" },
  head: { label: "Голова", icon: "ti-brain" },
  muscles: { label: "М'язи", icon: "ti-stretching" },
  ligaments: { label: "Зв'язки та сухожилля", icon: "ti-link" },
};

const SEQUENCES = ["T1", "T2", "STIR", "PD", "PD Fat Sat"];
const PLANES = ["Sag", "Cor", "Ax"];
const PLANE_LABELS = { Sag: "Сагітальна", Cor: "Коронарна", Ax: "Аксіальна" };

const RADIO_MAP = {
  "пкс": "ACL tear MRI", "зкс": "PCL tear MRI", "меніск": "meniscus tear MRI",
  "хрящ": "cartilage lesion MRI", "набряк": "bone marrow edema MRI",
  "тендиніт": "tendinitis MRI", "розрив": "ligament rupture MRI",
  "бурсит": "bursitis MRI", "синовіт": "synovitis MRI", "перелом": "stress fracture MRI",
  "ротаторна манжета": "rotator cuff tear MRI", "ахіллове": "achilles tendon MRI",
  "протрузія": "disc protrusion MRI", "грижа": "disc herniation MRI",
  "стеноз": "spinal stenosis MRI", "мієлопатія": "myelopathy MRI",
  "спондилолістез": "spondylolisthesis MRI", "гліома": "glioma MRI",
  "менінгіома": "meningioma MRI", "розсіяний склероз": "multiple sclerosis MRI",
  "розрив м'яза": "muscle tear MRI", "гематома": "intramuscular hematoma MRI",
  "міозит": "myositis MRI", "фасціїт": "fasciitis MRI",
};

const SYS_PROMPT = `You are an expert musculoskeletal radiologist with 20+ years of experience, assisting a sports medicine physician. Your goal is MAXIMUM diagnostic accuracy.

You receive: 1) REFERENCE normal MRI images, 2) optional ATLAS/knowledge-base rules, 3) PATIENT MRI series (possibly multiple sequences and planes), 4) optional clinical context.

ANALYSIS METHOD — think step by step (chain-of-thought):
STEP 1 — Orientation: For each series identify the sequence (T1/T2/STIR/PD) and plane (sagittal/coronal/axial). Note what each sequence is best for (T2/STIR = fluid/edema, T1 = anatomy/fat/marrow, PD = cartilage/menisci).
STEP 2 — Systematic review: Examine EACH anatomical structure relevant to the zone, one by one. Compare each with the normal reference.
STEP 3 — Signal analysis: For each abnormality assess signal intensity across sequences (a true lesion appears consistently across sequences; artifacts do not).
STEP 4 — Correlate: Cross-check findings between planes and sequences. A real finding is visible on multiple slices/sequences.
STEP 5 — Differential: For each significant finding, give the MOST LIKELY diagnosis plus 1-2 alternatives with relative likelihood.
STEP 6 — Confidence: Rate confidence honestly. High (85-100) only if clearly visible on multiple sequences. Medium (60-84) if suggestive. Low (<60) if subtle/single-sequence.

RULES:
- Respond ONLY in valid JSON, ALL text in Ukrainian
- Be specific: location, size estimate (small/moderate/large), signal characteristics
- Distinguish acute vs chronic when possible
- If a different sequence/plane would help confirm, say so in pulse_sequence_hint
- Do NOT invent findings. If normal, say so. False positives are as harmful as false negatives.

JSON:
{
  "reading_steps": "Короткий опис того, що ти послідовно перевірив (1-2 речення)",
  "findings": [{
    "id":1,
    "structure":"Анатомічна структура",
    "description":"Детальний опис: локалізація, розмір, характер сигналу на різних послідовностях",
    "slices":"T2_Sag: 3-5",
    "differential":[{"diagnosis":"Найімовірніший діагноз","likelihood":"висока"},{"diagnosis":"Альтернатива","likelihood":"низька"}],
    "confidence_level":85,
    "severity":"normal|mild|moderate|severe",
    "acuity":"гострий|хронічний|невизначено",
    "pulse_sequence_hint":"optional"
  }],
  "summary":"Структурований висновок",
  "recommendation":"Клінічна рекомендація — додаткові дослідження, консультації",
  "radiopaedia_terms":["ACL tear","bone marrow edema"]
}
Empty findings array if completely normal.`;

function anonymizeImage(dataUrl, crop = 12) {
  return new Promise(res => {
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const w = img.width - crop * 2, h = img.height - crop * 2;
      if (w <= 0 || h <= 0) { res(dataUrl); return; }
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, crop, crop, w, h, 0, 0, w, h);
      // Black out only TOP corners where patient name/DOB usually appears (not bottom — sequence params there help AI)
      ctx.fillStyle = "#000";
      const bw = Math.min(180, w * 0.28);
      ctx.fillRect(0, 0, bw, 24);
      ctx.fillRect(w - bw, 0, bw, 24);
      res(c.toDataURL("image/jpeg", 0.95));
    };
    img.src = dataUrl;
  });
}

const UA_TO_EN = {
  "пкс": "ACL tear MRI", "передня хрестоподібна": "ACL tear MRI",
  "зкс": "PCL tear MRI", "задня хрестоподібна": "PCL tear MRI",
  "меніск": "meniscus tear MRI", "латеральний меніск": "lateral meniscus tear MRI", "медіальний меніск": "medial meniscus tear MRI",
  "хрящ": "cartilage lesion MRI", "хрящова": "cartilage lesion MRI",
  "набряк": "bone marrow edema MRI", "набряк кістки": "bone marrow edema MRI", "набряк кісткового мозку": "bone marrow edema MRI",
  "тендиніт": "tendinitis MRI", "тендиноз": "tendinosis MRI", "тендинопатія": "tendinopathy MRI",
  "розрив": "ligament rupture MRI", "розрив зв'язки": "ligament rupture MRI", "розрив зв'язок": "ligament tear MRI",
  "бурсит": "bursitis MRI", "синовіт": "synovitis MRI",
  "перелом": "stress fracture MRI", "стресовий перелом": "stress fracture MRI",
  "ротаторна манжета": "rotator cuff tear MRI", "ротаторна": "rotator cuff tear MRI",
  "ахіллове": "achilles tendon MRI", "ахіл": "achilles tendon MRI",
  "протрузія": "disc protrusion MRI", "протрузія диска": "disc protrusion MRI",
  "грижа": "disc herniation MRI", "грижа диска": "disc herniation MRI", "екструзія": "disc extrusion MRI",
  "стеноз": "spinal stenosis MRI", "стеноз хребта": "spinal stenosis MRI",
  "мієлопатія": "myelopathy MRI", "спондилолістез": "spondylolisthesis MRI",
  "гліома": "glioma MRI", "менінгіома": "meningioma MRI",
  "розсіяний склероз": "multiple sclerosis MRI", "рс": "multiple sclerosis MRI",
  "розрив м'яза": "muscle tear MRI", "м'яз": "muscle tear MRI",
  "гематома": "intramuscular hematoma MRI", "міозит": "myositis MRI", "фасціїт": "fasciitis MRI",
  "коліно": "knee MRI", "кульшовий": "hip MRI", "плечовий": "shoulder MRI",
  "гомілковостоп": "ankle MRI", "ліктьовий": "elbow MRI", "зап'ястковий": "wrist MRI",
  "шийний": "cervical spine MRI", "грудний": "thoracic spine MRI", "поперековий": "lumbar spine MRI",
  "стегно": "thigh MRI", "гомілка": "calf MRI",
};

function radioUrl(term) {
  const t = term.trim().toLowerCase();
  if (UA_TO_EN[t]) return `https://radiopaedia.org/search?q=${encodeURIComponent(UA_TO_EN[t])}&scope=all`;
  for (const [k, v] of Object.entries(UA_TO_EN)) {
    if (t.includes(k) || k.includes(t)) return `https://radiopaedia.org/search?q=${encodeURIComponent(v)}&scope=all`;
  }
  return `https://radiopaedia.org/search?q=${encodeURIComponent(term.trim())}&scope=all`;
}

function translateTerm(term) {
  if (!term || !term.trim()) return null;
  const t = term.trim().toLowerCase();
  if (UA_TO_EN[t]) return UA_TO_EN[t];
  for (const [k, v] of Object.entries(UA_TO_EN)) {
    if (t.includes(k) || k.includes(t)) return v;
  }
  return null;
}

const confColor = (l) => {
  if (l >= 85) return { c: "#22c55e", bg: "rgba(34,197,94,.12)" };
  if (l >= 60) return { c: "#eab308", bg: "rgba(234,179,8,.12)" };
  return { c: "#ef4444", bg: "rgba(239,68,68,.12)" };
};

const QUICK_TERMS = [
  { ua: "ПКС", en: "ACL tear MRI" }, { ua: "ЗКС", en: "PCL tear MRI" },
  { ua: "Меніск", en: "meniscus tear MRI" }, { ua: "Хрящ", en: "cartilage lesion MRI" },
  { ua: "Набряк кістки", en: "bone marrow edema MRI" }, { ua: "Тендиніт", en: "tendinitis MRI" },
  { ua: "Розрив зв'язки", en: "ligament rupture MRI" }, { ua: "Бурсит", en: "bursitis MRI" },
  { ua: "Синовіт", en: "synovitis MRI" }, { ua: "Перелом", en: "stress fracture MRI" },
  { ua: "Ротаторна манжета", en: "rotator cuff tear MRI" }, { ua: "Ахіллове", en: "achilles tendon MRI" },
  { ua: "Протрузія диска", en: "disc protrusion MRI" }, { ua: "Грижа диска", en: "disc herniation MRI" },
  { ua: "Стеноз хребта", en: "spinal stenosis MRI" }, { ua: "Мієлопатія", en: "myelopathy MRI" },
  { ua: "Спондилолістез", en: "spondylolisthesis MRI" }, { ua: "Гліома", en: "glioma MRI" },
  { ua: "Менінгіома", en: "meningioma MRI" }, { ua: "Розсіяний склероз", en: "multiple sclerosis MRI" },
  { ua: "Розрив м'яза", en: "muscle tear MRI" }, { ua: "Гематома", en: "intramuscular hematoma MRI" },
  { ua: "Міозит", en: "myositis MRI" }, { ua: "Фасціїт", en: "fasciitis MRI" },
];

function RadioScreen({ setScr }) {
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

export default function MRIInsight() {
  const [scr, setScr] = useState("dash");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyIn, setApiKeyIn] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.5-pro");
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

  const refIn = useRef(null), pdfIn = useRef(null), patIn = useRef(null), recRef = useRef(null), attachIn = useRef(null), atlasIn = useRef(null);
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
        if (Object.keys(k).length > 0) setKb(k);
      } catch {}
    })();
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

  const uploadImgs = async (files, target) => {
    const list = Array.from(files).filter(f => f.type.startsWith("image/"));
    for (const f of list) {
      const d = await new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(f); });
      const fin = (target === "patient" && anon) ? await anonymizeImage(d) : d;
      const obj = { id: Date.now() + Math.random(), name: f.name, data: fin, ts: Date.now() };
      if (target === "ref") setRefs(p => ({ ...p, [selZone]: [...(p[selZone] || []), obj] }));
      else { const k = `${study.activeSeq}_${study.activePlane}`; setStudy(p => ({ ...p, series: { ...p.series, [k]: [...(p.series[k] || []), obj] } })); }
    }
    if (target === "patient" && anon && list.length > 0) flash(`Анонімізовано ${list.length} зображень`);
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
    setStudy({ id: Date.now(), patientName: "", age: "", complaints: "", mechanism: "", zone: "knee", activeSeq: "T2", activePlane: "Sag", series: {}, findings: null, status: "draft", date: new Date().toLocaleDateString("uk-UA") });
    setVnotes({}); setScr("new");
  };

  const loadStudy = async (id) => {
    try {
      const saved = await dbGet("studies", String(id));
      if (saved) {
        setStudy(saved);
        setConclusionReview(saved.conclusionReview || null);
        setScr("results");
      } else {
        flash("Дані дослідження не знайдено");
      }
    } catch { flash("Помилка завантаження"); }
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

  const handleAttachment = async (files) => {
    if (!study) return;
    const attachments = [...(study.attachments || [])];
    for (const file of Array.from(files)) {
      const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); });
      attachments.push({ id: Date.now() + Math.random(), name: file.name, type: file.type, data: dataUrl, ts: Date.now() });
    }
    setStudy(p => ({ ...p, attachments }));
    // Save updated study
    try { await dbPut("studies", String(study.id), { ...study, attachments }); } catch {}
    flash(`Додано ${files.length} файл(ів)`);
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
      parts.push({ text: `Ти радіолог-експерт та анатом. Лікар виділив конкретну ділянку на МРТ знімку для детального аналізу.
Зона: ${ZONES[study.zone]?.ua}
Серія: ${seriesKey()}
Зріз: ${splitIdx + 1}

Проаналізуй ВИДІЛЕНУ ДІЛЯНКУ максимально детально. Відповідай ТІЛЬКИ JSON українською:
{
  "structure": "Назва анатомічної структури",
  "anatomy": {
    "description": "Що це за структура — коротко, 1-2 речення",
    "function": "Яку функцію виконує",
    "origin": "Місце початку/проксимальне прикріплення (для м'язів та зв'язок)",
    "insertion": "Місце прикріплення/дистальне прикріплення",
    "innervation": "Іннервація (для м'язів)",
    "clinical_note": "Клінічне значення — яка патологія найчастіше трапляється"
  },
  "findings": "Детальний опис того що бачиш на знімку",
  "pathology": "Є патологія чи норма — конкретно",
  "confidence_level": 85,
  "severity": "normal|mild|moderate|severe",
  "recommendation": "Рекомендація"
}
Для кісток або суглобових поверхонь замість origin/insertion вкажи суглобові поверхні та зв'язки.
Для менісків, хрящів — відповідну анатомію.` });

      // Send atlas images (labeled anatomy references) if available
      const zoneAtlas = atlas[study.zone] || [];
      if (zoneAtlas.length > 0) {
        parts.push({ text: "\n--- АНАТОМІЧНИЙ АТЛАС (підписані структури для орієнтації) ---" });
        for (const a of zoneAtlas.slice(0, 10)) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: a.data.split(",")[1] } });
          if (a.label) parts.push({ text: `Підпис: ${a.label}` });
        }
      }

      // Send reference normal images if available
      const zoneRefs = refs[study.zone] || [];
      if (zoneRefs.length > 0) {
        parts.push({ text: "\n--- РЕФЕРЕНСИ НОРМИ (для порівняння) ---" });
        for (const r of zoneRefs.slice(0, 5)) {
          parts.push({ inline_data: { mime_type: "image/jpeg", data: r.data.split(",")[1] } });
        }
      }

      // Knowledge base rules
      const zoneKb = kb[study.zone] || [];
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
      try { setRoiResult(JSON.parse(clean)); } catch { setRoiResult({ structure: "Аналіз", findings: clean, pathology: "—", confidence_level: 50, severity: "mild", recommendation: "" }); }
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
  const seriesKey = () => `${study?.activeSeq}_${study?.activePlane}`;
  const curImgs = () => (study?.series?.[seriesKey()] || []);
  const allImgs = () => Object.entries(study?.series || {}).flatMap(([key, imgs]) => imgs.map(im => ({ ...im, seriesKey: key })));
  const totalCount = () => Object.values(study?.series || {}).reduce((s, a) => s + a.length, 0);
  const seriesCounts = () => {
    const c = {};
    Object.entries(study?.series || {}).forEach(([k, v]) => { if (v.length > 0) c[k] = v.length; });
    return c;
  };

  const analyze = async () => {
    if (!apiKey) { setShowSet(true); return; }
    const zrefs = refs[study.zone] || [];
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

      // Knowledge base rules
      const zoneKb = kb[study.zone] || [];
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


  const Dash = () => (
    <div style={P.pg}>
      <div style={P.hdr}>
        <div style={P.logo}>
          <span style={{ width: 30, height: 30, borderRadius: 6, background: "#15324a", display: "flex", alignItems: "center", justifyContent: "center" }}><Brain size={19} style={{ color: "#4aa3df" }} /></span>
          <div><div style={{ fontSize: 15, fontWeight: 500, color: "#e8eaed" }}>MRI Insight</div><p style={P.sub}>RADIOLOGY WORKSTATION</p></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#4aa3df", background: "#15324a", padding: "4px 10px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{aiModel === "gemini-2.5-pro" ? "GEMINI 2.5 PRO" : "GEMINI 2.5 FLASH"}</span>
          <button onClick={() => setShowSet(true)} style={P.iBtn}><Settings size={18} /></button>
        </div>
      </div>
      <div style={P.body}>
      {!apiKey && <div style={{ ...P.warn, margin: "0 0 14px" }}><AlertCircle size={16} style={{ color: "#e0a93b", flexShrink: 0 }} /><div><p style={{ fontSize: 13, fontWeight: 500, color: "#e0a93b" }}>API ключ не налаштовано</p><p style={P.ws}>Налаштування → введіть ключ</p></div></div>}
      <div style={P.g3}>
        <button onClick={newStudy} style={P.act}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Plus size={18} style={{ color: "#4aa3df" }} /><span style={P.aLb}>Нове дослідження</span></div><span style={{ fontSize: 11, color: "#5f6672" }}>Завантажити серії пацієнта</span></button>
        <button onClick={() => setScr("lib")} style={P.act}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={18} style={{ color: "#9b8cdb" }} /><span style={P.aLb}>Бібліотека</span></div><span style={{ fontSize: 11, color: "#5f6672" }}>Норми · атлас · база знань</span></button>
        <button onClick={() => setScr("radio")} style={P.act}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><ExternalLink size={18} style={{ color: "#4ec99b" }} /><span style={P.aLb}>Radiopaedia</span></div><span style={{ fontSize: 11, color: "#5f6672" }}>Довідник патологій</span></button>
      </div>
      <div style={P.chips}><ZoneGroups countFn={(k) => (refs[k] || []).length} renderZone={(k, v) => {
        const c = (refs[k] || []).length;
        return <div key={k} style={P.chip}><span style={P.chN}>{v.short}</span><span style={P.chC}>{c}</span></div>;
      }} /></div>
      {studies.length > 0 && <div>
        <p style={P.secT}>Останні дослідження</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button onClick={() => setShowArchive(false)} style={{ ...P.sm, padding: "6px 14px", fontSize: 12, background: !showArchive ? "#15324a" : "#1a1d24", color: !showArchive ? "#4aa3df" : "#8b919c", border: !showArchive ? "0.5px solid rgba(74,163,223,.4)" : "0.5px solid rgba(255,255,255,.08)" }}>Активні ({studies.filter(s => !s.archived).length})</button>
          <button onClick={() => setShowArchive(true)} style={{ ...P.sm, padding: "6px 14px", fontSize: 12, background: showArchive ? "rgba(155,140,219,.14)" : "#1a1d24", color: showArchive ? "#9b8cdb" : "#8b919c", border: showArchive ? "0.5px solid rgba(155,140,219,.4)" : "0.5px solid rgba(255,255,255,.08)" }}>Архів ({studies.filter(s => s.archived).length})</button>
        </div>
        {studies.filter(s => showArchive ? s.archived : !s.archived).map(s => (
          <div key={s.id} style={{ ...P.sCard, cursor: "pointer" }}>
            <div onClick={() => loadStudy(s.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
              <i className="ti ti-photo" style={{ fontSize: 18, color: "#5f6672" }} aria-hidden="true" />
              <div>
                <p style={P.sN}>{s.pn || "Без імені"}</p>
                <p style={P.sM}>{ZONES[s.z]?.ua} · {s.ic} зрізів · {s.d}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {s.fc > 0 ? <span style={P.bdLg}>{s.fc} ЗНАХІДОК</span> : <span style={P.bdOk}>НОРМА</span>}
              {showArchive ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); unarchiveStudy(s.id); }} title="Відновити" style={{ ...P.sm, color: "#9b8cdb", padding: 4 }}><RotateCcw size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Видалити назавжди?")) deleteStudy(s.id); }} title="Видалити" style={{ ...P.sm, color: "#e24b4a", padding: 4 }}><Trash2 size={13} /></button>
                </>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); archiveStudy(s.id); }} title="В архів" style={{ ...P.sm, color: "#8b919c", padding: 4 }}><Archive size={13} /></button>
              )}
              <ChevronRight size={14} style={{ color: "#5f6672" }} />
            </div>
          </div>
        ))}
        {studies.filter(s => showArchive ? s.archived : !s.archived).length === 0 && (
          <p style={{ fontSize: 13, color: "#5f6672", textAlign: "center", padding: "16px 0" }}>{showArchive ? "Архів порожній" : "Немає активних досліджень"}</p>
        )}
      </div>}
      </div>
    </div>
  );

  const Lib = () => {
    const imgs = refs[selZone] || [];
    const atlasImgs = atlas[selZone] || [];
    return (
      <div style={P.pg}>
        <div style={P.top}><button onClick={() => setScr("dash")} style={P.bk}><ArrowLeft size={16} /> Назад</button><h2 style={P.pT}>Бібліотека</h2></div>

        {/* Library tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setLibTab("refs")} style={{ ...P.sm, padding: "8px 16px", fontSize: 12, background: libTab === "refs" ? "#15324a" : "#1a1d24", color: libTab === "refs" ? "#4aa3df" : "#8b919c", border: libTab === "refs" ? "0.5px solid rgba(74,163,223,.4)" : "0.5px solid rgba(255,255,255,.08)" }}>
            <BookOpen size={14} style={{ marginRight: 4 }} /> Референси норми
          </button>
          <button onClick={() => setLibTab("atlas")} style={{ ...P.sm, padding: "8px 16px", fontSize: 12, background: libTab === "atlas" ? "rgba(155,140,219,.14)" : "#1a1d24", color: libTab === "atlas" ? "#9b8cdb" : "#8b919c", border: libTab === "atlas" ? "0.5px solid rgba(155,140,219,.4)" : "0.5px solid rgba(255,255,255,.08)" }}>
            <i className="ti ti-book-2" style={{ fontSize: 14, marginRight: 4 }} aria-hidden="true" /> Анатомічний атлас ({Object.values(atlas).reduce((s, a) => s + a.length, 0)})
          </button>
          <button onClick={() => setLibTab("kb")} style={{ ...P.sm, padding: "8px 16px", fontSize: 12, background: libTab === "kb" ? "rgba(224,169,59,.14)" : "#1a1d24", color: libTab === "kb" ? "#e0a93b" : "#8b919c", border: libTab === "kb" ? "0.5px solid rgba(224,169,59,.4)" : "0.5px solid rgba(255,255,255,.08)" }}>
            <i className="ti ti-file-text" style={{ fontSize: 14, marginRight: 4 }} aria-hidden="true" /> База знань ({Object.values(kb).reduce((s, a) => s + a.length, 0)})
          </button>
        </div>

        <div style={P.ztabs}><ZoneGroups countFn={(k) => libTab === "refs" ? (refs[k] || []).length : libTab === "atlas" ? (atlas[k] || []).length : (kb[k] || []).length} renderZone={(k, v) => {
          const cnt = libTab === "refs" ? (refs[k] || []).length : libTab === "atlas" ? (atlas[k] || []).length : (kb[k] || []).length;
          return <button key={k} onClick={() => setSelZone(k)} style={selZone === k ? P.ztOn : P.zt}>{v.short}{cnt > 0 && <span style={P.ztB}>{cnt}</span>}</button>;
        }} /></div>

        {libTab === "refs" ? (<>
          {/* REFS TAB */}
          <div style={P.upRow}>
            <div style={P.upC} onClick={() => refIn.current?.click()}><Upload size={20} style={{ color: "#06b6d4" }} /><span style={P.upL}>JPEG знімки</span><input ref={refIn} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => uploadImgs(e.target.files, "ref")} /></div>
            <div style={{ ...P.upC, opacity: pdfOk ? 1 : 0.4 }} onClick={() => pdfOk && pdfIn.current?.click()}><FileText size={20} style={{ color: "#a78bfa" }} /><span style={P.upL}>PDF книга</span><input ref={pdfIn} type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => e.target.files[0] && uploadPdf(e.target.files[0])} /></div>
            <div style={P.upC} onClick={() => flash("Скопіюйте зображення та натисніть Ctrl+V")}><span style={{ fontSize: 20 }}>📋</span><span style={P.upL}>Вставити</span></div>
          </div>
          <p style={{ fontSize: 10, color: "#475569", marginTop: -8, marginBottom: 10, textAlign: "center" }}>Ctrl+V — вставити зображення з Radiopaedia або будь-якого сайту</p>
          {imgs.length === 0 ? <div style={{ textAlign: "center", padding: "36px 16px" }}><BookOpen size={32} style={{ color: "#1e293b" }} /><p style={{ fontSize: 13, color: "#475569", marginTop: 10 }}>Завантажте знімки норми з книг</p></div>
            : <><p style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{imgs.length} реф. — "{ZONES[selZone].ua}"</p>
              <div style={P.iGrid}>{imgs.map((im, i) => <div key={im.id} style={P.thBox}>
                <img src={im.data} alt="" style={P.th} onClick={() => setViewImg(im)} />
                <button onClick={() => setRefs(p => ({ ...p, [selZone]: p[selZone].filter(x => x.id !== im.id) }))} style={P.thDel}><X size={10} /></button>
                <span style={P.thIdx}>{i + 1}</span>
                {im.pg && <span style={P.thPg}>с.{im.pg}</span>}
                {im.src === "clipboard" && !im.pg && <span style={P.thClip}>📋</span>}
                {im.caption && <div style={P.thCap}>{im.caption}</div>}
              </div>)}</div></>}
        </>) : (<>
          {/* ATLAS TAB */}
          <div style={{ background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.12)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: "#a78bfa", lineHeight: 1.5 }}>
              📖 Завантажте підписані зображення анатомії з книг або атласів. Кожне зображення повинно мати опис — яка структура зображена. ІІ використовуватиме ці зображення при аналізі ROI для точнішої ідентифікації структур.
            </p>
          </div>
          <div style={P.upRow}>
            <div style={P.upC} onClick={() => atlasIn.current?.click()}><Upload size={20} style={{ color: "#a78bfa" }} /><span style={P.upL}>Додати зображення</span>
              <input ref={atlasIn} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={async (e) => {
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
          {atlasImgs.length === 0 ? <div style={{ textAlign: "center", padding: "36px 16px" }}><span style={{ fontSize: 32 }}>📖</span><p style={{ fontSize: 13, color: "#475569", marginTop: 10 }}>Додайте підписані зображення анатомії</p><p style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Сторінки з атласу, схеми, підписані МРТ</p></div>
            : <><p style={{ fontSize: 12, color: "#a78bfa", marginBottom: 6 }}>{atlasImgs.length} зображень атласу — "{ZONES[selZone].ua}"</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                {atlasImgs.map((im) => (
                  <div key={im.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(139,92,246,.12)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                    <img src={im.data} alt="" style={{ width: "100%", display: "block", cursor: "pointer" }} onClick={() => setViewImg(im)} />
                    <div style={{ padding: "6px 8px", background: "rgba(139,92,246,.06)" }}>
                      <p style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, lineHeight: 1.3 }}>{im.label}</p>
                    </div>
                    <button onClick={() => setAtlas(p => ({ ...p, [selZone]: (p[selZone] || []).filter(x => x.id !== im.id) }))}
                      style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.7)", border: "none", borderRadius: 4, padding: 2, color: "#ef4444", cursor: "pointer" }}><X size={10} /></button>
                  </div>
                ))}
              </div></>}
        </>)}

        {libTab === "kb" && (<>
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
            <Plus size={14} style={{ marginRight: 4 }} /> Додати правило для "{ZONES[selZone].short}"
          </button>
          {(kb[selZone] || []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px" }}>
              <span style={{ fontSize: 32 }}>📝</span>
              <p style={{ fontSize: 13, color: "#475569", marginTop: 10 }}>Немає правил для цієї зони</p>
              <p style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Додайте діагностичні критерії з відео, книг або власного досвіду</p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 8 }}>{(kb[selZone] || []).length} правил — "{ZONES[selZone].ua}"</p>
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
        </>)}

        {pdfM && <div style={P.ov} onClick={() => !pdfM.ld && setPdfM(null)}><div style={P.pdfPan} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div><h3 style={P.panT}>{pdfM.nm}</h3><p style={P.ht}>{pdfM.tot} стор. · Обрано: {pdfM.sel.size}</p></div>{!pdfM.ld && <button onClick={() => setPdfM(null)} style={P.clX}><X size={14} /></button>}</div>
          {pdfM.ld && <div style={{ padding: "14px 0" }}><div style={P.prB}><div style={{ ...P.prF, width: `${pdfM.pr}%` }} /></div><p style={P.prT}>{pdfM.pr < 100 ? `Завантаження... ${pdfM.pr}%` : "Рендеринг..."}</p></div>}
          {!pdfM.ld && pdfM.th.length > 0 && <>
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
            <div style={P.pdfG}>{pdfM.th.map(t => <div key={t.p} onClick={() => setPdfM(p => { const s = new Set(p.sel); s.has(t.p) ? s.delete(t.p) : s.add(t.p); return { ...p, sel: s }; })} style={{ ...P.pdfTh, border: pdfM.sel.has(t.p) ? "2px solid #06b6d4" : "2px solid transparent" }}><img src={t.d} alt="" style={{ width: "100%", display: "block", borderRadius: 4 }} />{pdfM.sel.has(t.p) && <div style={P.pdfCh}><Check size={10} /></div>}<span style={P.pdfN}>{t.p}</span></div>)}</div>
            <button onClick={addPdfPages} disabled={pdfM.sel.size === 0} style={{ ...P.pri, opacity: pdfM.sel.size === 0 ? 0.4 : 1 }}>Додати {pdfM.sel.size} стор. → "{ZONES[selZone].short}"</button>
          </>}
        </div></div>}
      </div>
    );
  };

  const New = () => {
    const zr = refs[study?.zone] || [];
    const ci = curImgs();
    const tc = totalCount();
    return (
      <div style={P.pg}>
        <div style={P.top}><button onClick={() => setScr("dash")} style={P.bk}><ArrowLeft size={16} /> Назад</button><h2 style={P.pT}>Нове дослідження</h2></div>
        <label style={P.lb}>Пацієнт</label>
        <input value={study?.patientName || ""} onChange={e => setStudy(p => ({ ...p, patientName: e.target.value }))} placeholder="ПІБ або ID" style={P.inp} />

        <label style={P.lb}>Клінічний контекст (підвищує точність ІІ)</label>
        <input value={study?.age || ""} onChange={e => setStudy(p => ({ ...p, age: e.target.value }))} placeholder="Вік пацієнта" style={{ ...P.inp, marginBottom: 6 }} />
        <input value={study?.complaints || ""} onChange={e => setStudy(p => ({ ...p, complaints: e.target.value }))} placeholder="Скарги (напр. біль у коліні при згинанні)" style={{ ...P.inp, marginBottom: 6 }} />
        <input value={study?.mechanism || ""} onChange={e => setStudy(p => ({ ...p, mechanism: e.target.value }))} placeholder="Механізм травми / анамнез" style={P.inp} />

        <label style={P.lb}>Зона дослідження</label>
        <ZoneGroups countFn={(k) => (refs[k] || []).length} renderZone={(k, v) => (
          <button key={k} onClick={() => setStudy(p => ({ ...p, zone: k }))} style={study?.zone === k ? P.selOn : P.sel}>
            {v.short}{(refs[k] || []).length > 0 && <span style={{ marginLeft: 5, fontSize: 9, color: "#4aa3df", fontFamily: "'JetBrains Mono',monospace" }}>{(refs[k] || []).length}</span>}
          </button>
        )} />

        {zr.length === 0 && <div style={{ ...P.warn, marginTop: 6 }}><AlertCircle size={14} style={{ color: "#f59e0b", flexShrink: 0 }} /><p style={P.ws}>Немає референсів. <span onClick={() => { setSelZone(study.zone); setScr("lib"); }} style={{ color: "#06b6d4", cursor: "pointer", textDecoration: "underline" }}>Завантажити</span></p></div>}
        {zr.length > 0 && <div style={P.refBx}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><BookOpen size={13} />{zr.length} референсів</span>
            <button onClick={() => { setSelZone(study.zone); setScr("lib"); }} style={P.lnk}>Переглянути</button></div>
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>{zr.slice(0, 8).map(r => <img key={r.id} src={r.data} alt="" style={P.mini} onClick={() => setViewImg(r)} />)}{zr.length > 8 && <span style={P.more}>+{zr.length - 8}</span>}</div>
        </div>}

        <label style={P.lb}>Послідовність</label>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>{SEQUENCES.map(s => (
          <button key={s} onClick={() => setStudy(p => ({ ...p, activeSeq: s }))}
            style={study?.activeSeq === s ? P.sqOn : P.sq}>{s}</button>
        ))}</div>

        <label style={P.lb}>Площина</label>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>{PLANES.map(pl => (
          <button key={pl} onClick={() => setStudy(p => ({ ...p, activePlane: pl }))}
            style={study?.activePlane === pl ? P.sqOn : P.sq}>{PLANE_LABELS[pl]} ({pl})</button>
        ))}</div>

        <div style={{ background: "rgba(6,182,212,.06)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#06b6d4", fontWeight: 600 }}>
          Активна серія: {study?.activeSeq} · {PLANE_LABELS[study?.activePlane]} — {ci.length} зрізів
        </div>

        {/* Series summary */}
        {tc > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.entries(study.series).filter(([_,a]) => a.length > 0).map(([s, a]) => (
              <button key={s} onClick={() => { const [seq, pl] = s.split("_"); setStudy(p => ({ ...p, activeSeq: seq, activePlane: pl })); }}
                style={{ fontSize: 11, background: s === seriesKey() ? "rgba(6,182,212,.15)" : "rgba(255,255,255,.04)", border: s === seriesKey() ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.06)", borderRadius: 6, padding: "3px 8px", color: s === seriesKey() ? "#06b6d4" : "#94a3b8", cursor: "pointer" }}>
                {s.replace("_", " ")}: {a.length}
              </button>
            ))}
            <div style={{ fontSize: 11, background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "3px 8px", color: "#94a3b8" }}>Разом: {tc}</div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, marginBottom: 10, padding: "9px 12px", background: "rgba(255,255,255,.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,.06)" }}>
          <button onClick={() => { setAnon(!anon); try { localStorage.setItem("mri-an", (!anon).toString()); } catch {} }}
            style={{ ...P.sm, background: anon ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", color: anon ? "#06b6d4" : "#64748b", border: anon ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.08)" }}>{anon ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <div><p style={{ fontSize: 12, fontWeight: 600, color: anon ? "#06b6d4" : "#64748b" }}>Анонімізація {anon ? "увімкнена" : "вимкнена"}</p><p style={{ fontSize: 10, color: "#475569" }}>Обрізка країв та приховування даних</p></div>
        </div>

        <label style={P.lb}>Знімки {study?.activeSeq} {study?.activePlane} ({ci.length})</label>
        <div style={P.drop} onClick={() => patIn.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); uploadImgs(e.dataTransfer.files, "patient"); }}>
          <Upload size={24} style={{ color: "#475569" }} /><p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>Завантажте JPEG зрізи для {study?.activeSeq} {PLANE_LABELS[study?.activePlane]}</p>
          <input ref={patIn} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => uploadImgs(e.target.files, "patient")} /></div>

        {ci.length > 0 && <>
          <div style={P.iGrid}>{ci.map((im, i) => <div key={im.id} style={P.thBox}>
            <img src={im.data} alt="" style={P.th} onClick={() => setViewImg(im)} />
            <button onClick={() => { const k = seriesKey(); setStudy(p => ({ ...p, series: { ...p.series, [k]: p.series[k].filter(x => x.id !== im.id) } })); }} style={P.thDel}><X size={10} /></button>
            <span style={P.thIdx}>{i + 1}</span>
            {vnotes[`${seriesKey()}-${i}`] && <span style={P.vDot}><Mic size={7} /></span>}
          </div>)}</div>

          <div style={{ marginBottom: 12 }}>
            <label style={P.lb}>Голосові нотатки ({study?.activeSeq} {study?.activePlane})</label>
            <p style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>Оберіть зріз та диктуйте</p>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
              {ci.slice(0, 24).map((_, i) => {
                const noteKey = `${seriesKey()}-${i}`;
                return <button key={i} onClick={() => recording === noteKey ? stopVoice() : startVoice(noteKey)}
                  style={{ ...P.sm, minWidth: 32, background: recording === noteKey ? "rgba(239,68,68,.18)" : vnotes[noteKey] ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", color: recording === noteKey ? "#ef4444" : vnotes[noteKey] ? "#06b6d4" : "#64748b", border: recording === noteKey ? "1px solid rgba(239,68,68,.3)" : "1px solid rgba(255,255,255,.07)" }}>
                  {recording === noteKey ? <Square size={9} /> : vnotes[noteKey] ? <Volume2 size={9} /> : i + 1}</button>;
              })}
            </div>
            {recording !== null && <p style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}><Mic size={11} /> Запис...</p>}
            {Object.entries(vnotes).filter(([k, v]) => k.startsWith(seriesKey()) && v.trim()).map(([k, v]) => <div key={k} style={{ fontSize: 11, color: "#94a3b8", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}><span style={{ color: "#06b6d4", fontWeight: 600 }}>{k}:</span> {v.trim()}</div>)}
          </div>
        </>}

        {tc > 0 && <>
          <button onClick={() => goSplit("new")} style={P.secBtn}><Columns size={16} /> Порівняти з нормою (Split-Screen)</button>
          <button onClick={analyze} style={P.anaBtn}><Zap size={18} /> Аналіз ІІ ({tc} зрізів{zr.length > 0 ? ` + ${zr.length} реф.` : ""})</button>
        </>}
      </div>
    );
  };

  const Split = () => {
    const zr = refs[study?.zone] || [];
    const im = curImgs();
    const noteKey = `${seriesKey()}-${splitIdx}`;
    const cc = roiResult ? confColor(roiResult.confidence_level || 50) : null;
    return (
      <div style={{ padding: "8px 12px 12px", color: "#e2e8f0", fontFamily: "'IBM Plex Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <button onClick={() => { setScr(prevScr); setRoi(null); setRoiResult(null); }} style={P.bk}><ArrowLeft size={16} /> Назад</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Порівняння</span>
          <div style={{ display: "flex", gap: 3, marginLeft: "auto", flexWrap: "wrap" }}>
            {Object.entries(seriesCounts()).map(([k, cnt]) => (
              <button key={k} onClick={() => { const [seq, pl] = k.split("_"); setStudy(p => ({ ...p, activeSeq: seq, activePlane: pl })); setSplitIdx(0); setRoi(null); setRoiResult(null); }}
                style={{ ...k === seriesKey() ? P.sqOn : P.sq, padding: "4px 8px", fontSize: 9 }}>{k.replace("_", " ")} ({cnt})</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: roiResult ? "1fr 1fr 300px" : "1fr 1fr", gap: 6, height: "calc(100vh - 80px)" }}>
          {/* PATIENT with ROI */}
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 8, padding: 4, display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textAlign: "center", marginBottom: 3, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Crosshair size={10} /> Пацієнт · {study?.activeSeq} {study?.activePlane} · {im.length > 0 ? `${splitIdx + 1}/${im.length}` : "—"}
            </p>
            <div ref={roiImgRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", cursor: "crosshair", userSelect: "none" }}
              onMouseDown={roiMouseDown} onMouseMove={roiMouseMove} onMouseUp={roiMouseUp} onMouseLeave={() => { if (roiDrawing) setRoiDrawing(false); }}>
              {im[splitIdx] ? <img src={im[splitIdx].data} alt="" draggable={false} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6, pointerEvents: "none" }} /> : <span style={{ color: "#334155" }}>—</span>}
              {/* ROI rectangle overlay */}
              {roi && (
                <div style={{
                  position: "absolute",
                  left: `${roi.x * 100}%`, top: `${roi.y * 100}%`,
                  width: `${roi.w * 100}%`, height: `${roi.h * 100}%`,
                  border: "2px solid #f59e0b", background: "rgba(245,158,11,.12)",
                  borderRadius: 3, pointerEvents: "none",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,.3)",
                }} />
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "4px 0", flexWrap: "wrap" }}>
              <button disabled={splitIdx <= 0} onClick={() => { setSplitIdx(splitIdx - 1); setRoi(null); setRoiResult(null); }} style={P.nv}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 10, color: "#64748b" }}>{im.length > 0 ? `${splitIdx + 1}/${im.length}` : "—"}</span>
              <button disabled={splitIdx >= im.length - 1} onClick={() => { setSplitIdx(splitIdx + 1); setRoi(null); setRoiResult(null); }} style={P.nv}><ChevronRight size={14} /></button>
              <button onClick={() => recording === noteKey ? stopVoice() : startVoice(noteKey)} style={{ ...P.sm, marginLeft: 4, background: recording === noteKey ? "rgba(239,68,68,.18)" : "rgba(255,255,255,.04)", color: recording === noteKey ? "#ef4444" : "#94a3b8" }}>{recording === noteKey ? <MicOff size={11} /> : <Mic size={11} />}</button>
              {roi && roi.w > 0.02 && (
                <button onClick={analyzeRoi} disabled={roiLoading} style={{ ...P.sm, padding: "4px 12px", background: "rgba(245,158,11,.14)", border: "1px solid rgba(245,158,11,.3)", color: "#f59e0b" }}>
                  {roiLoading ? "⏳ Аналіз..." : <><Crosshair size={12} /> Аналіз ділянки</>}
                </button>
              )}
              {roi && <button onClick={() => { setRoi(null); setRoiResult(null); }} style={{ ...P.sm, padding: "4px 8px", color: "#64748b" }}><X size={12} /></button>}
            </div>
            {!roi && <p style={{ fontSize: 9, color: "#475569", textAlign: "center" }}>Виділіть мишкою ділянку для аналізу ІІ</p>}
          </div>
          {/* REFERENCE */}
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 8, padding: 4, display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textAlign: "center", marginBottom: 3, textTransform: "uppercase" }}>Норма · {zr.length > 0 ? `${refIdx + 1}/${zr.length}` : "—"}</p>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {zr[refIdx] ? <img src={zr[refIdx].data} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6, cursor: "pointer" }} onClick={() => setViewImg(zr[refIdx])} /> : <span style={{ color: "#334155" }}>Немає реф.</span>}
            </div>
            {zr.length > 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 0" }}>
              <button disabled={refIdx <= 0} onClick={() => setRefIdx(refIdx - 1)} style={P.nv}><ChevronLeft size={14} /></button>
              <span style={{ fontSize: 10, color: "#64748b" }}>{refIdx + 1}/{zr.length}</span>
              <button disabled={refIdx >= zr.length - 1} onClick={() => setRefIdx(refIdx + 1)} style={P.nv}><ChevronRight size={14} /></button>
            </div>}
          </div>
          {/* ROI RESULT PANEL */}
          {roiResult && (
            <div style={{ background: "rgba(245,158,11,.04)", border: "1px solid rgba(245,158,11,.15)", borderRadius: 8, padding: 12, overflowY: "auto" }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}><Crosshair size={14} /> Аналіз ділянки</h4>

              {/* Structure name */}
              <div style={{ marginBottom: 8, padding: "8px 10px", background: "rgba(255,255,255,.04)", borderRadius: 6 }}>
                <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Структура</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{roiResult.structure}</p>
              </div>

              {/* Anatomy reference */}
              {roiResult.anatomy && (
                <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(139,92,246,.06)", border: "1px solid rgba(139,92,246,.12)", borderRadius: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: "#a78bfa", textTransform: "uppercase", marginBottom: 6 }}>📖 Анатомічна довідка</p>
                  {roiResult.anatomy.description && <p style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 4, lineHeight: 1.4 }}>{roiResult.anatomy.description}</p>}
                  {roiResult.anatomy.function && (
                    <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>Функція: </span><span style={{ fontSize: 11, color: "#94a3b8" }}>{roiResult.anatomy.function}</span></div>
                  )}
                  {roiResult.anatomy.origin && (
                    <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>Початок: </span><span style={{ fontSize: 11, color: "#94a3b8" }}>{roiResult.anatomy.origin}</span></div>
                  )}
                  {roiResult.anatomy.insertion && (
                    <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>Прикріплення: </span><span style={{ fontSize: 11, color: "#94a3b8" }}>{roiResult.anatomy.insertion}</span></div>
                  )}
                  {roiResult.anatomy.innervation && (
                    <div style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>Іннервація: </span><span style={{ fontSize: 11, color: "#94a3b8" }}>{roiResult.anatomy.innervation}</span></div>
                  )}
                  {roiResult.anatomy.clinical_note && (
                    <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(139,92,246,.1)" }}>
                      <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>⚕ Клінічне: </span><span style={{ fontSize: 11, color: "#fbbf24" }}>{roiResult.anatomy.clinical_note}</span>
                    </div>
                  )}
                </div>
              )}

              {/* MRI findings */}
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Що видно на знімку</p>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: "#cbd5e1" }}>{roiResult.findings}</p>
              </div>

              {/* Pathology + confidence */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Патологія</p>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{roiResult.pathology}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>Впевненість</p>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: cc?.bg, color: cc?.c }}>{roiResult.confidence_level}%</span>
                </div>
              </div>

              {roiResult.recommendation && (
                <div style={{ background: "rgba(6,182,212,.08)", borderRadius: 6, padding: 8, marginTop: 4 }}>
                  <p style={{ fontSize: 10, color: "#06b6d4", fontWeight: 600, marginBottom: 2 }}>Рекомендація</p>
                  <p style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>{roiResult.recommendation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Loading = () => (
    <div style={P.pg}><div style={P.center}>
      <div style={P.pulse}><Brain size={40} style={{ color: "#06b6d4" }} /></div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Аналіз МРТ</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{study?.patientName || "Пацієнт"} · {ZONES[study?.zone]?.ua}</p>
      {prog && <><div style={P.prB}><div style={{ ...P.prF, width: `${prog.p}%` }} /></div>
        <p style={P.prT}>{prog.s === "send" ? "Відправка зображень..." : prog.s === "ai" ? "ІІ аналізує зрізи..." : "Формування звіту..."}</p></>}
    </div></div>
  );

  const Results = () => {
    const f = study?.findings || [];
    const zr = refs[study?.zone] || [];
    return (
      <div style={P.pg}>
        <div style={P.top}><button onClick={() => setScr("dash")} style={P.bk}><ArrowLeft size={16} /> Головна</button><h2 style={P.pT}>Результати</h2></div>
        <div style={P.resH}>
          <div><p style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9" }}>{study?.patientName || "Пацієнт"}</p>
            <p style={P.sM}>{ZONES[study?.zone]?.ua} · {Object.entries(study?.series || {}).filter(([_,a]) => a.length > 0).map(([s]) => s).join(", ")} · {study?.date}</p>
            <p style={P.sM}>{totalCount()} зрізів</p></div>
          <span style={f.length > 0 ? P.bdLg : P.bdOk}>{f.length > 0 ? `${f.length} знахідок` : <><CheckCircle size={14} /> Норма</>}</span>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {zr.length > 0 && <button onClick={() => setShowRefP(true)} style={P.rvBtn}><BookOpen size={14} /> Норма ({zr.length})</button>}
          {totalCount() > 0 && <button onClick={() => goSplit("results")} style={P.rvBtn}><Columns size={14} /> Split-Screen</button>}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button onClick={() => generateReport("clinical")} style={P.repBtn}>
            <FileText size={14} /> Клінічний звіт
          </button>
          <button onClick={() => generateReport("trainer")} style={{ ...P.repBtn, background: "rgba(139,92,246,.08)", borderColor: "rgba(139,92,246,.2)", color: "#a78bfa" }}>
            <FileText size={14} /> Звіт для тренера
          </button>
        </div>

        {study?.summary && <div style={P.sumC}><h4 style={P.sumT}>Висновок</h4><p style={P.sumTx}>{study.summary}</p></div>}
        {study?.recommendation && <div style={{ ...P.sumC, borderColor: "#06b6d4" }}><h4 style={{ ...P.sumT, color: "#06b6d4" }}>Рекомендація</h4><p style={P.sumTx}>{study.recommendation}</p></div>}

        {f.some(x => x.pulse_sequence_hint) && <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <h4 style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><Info size={13} /> Підказки щодо послідовностей</h4>
          {f.filter(x => x.pulse_sequence_hint).map((x, i) => <p key={i} style={{ fontSize: 12, color: "#fbbf24", marginTop: 3 }}>• {x.pulse_sequence_hint}</p>)}
        </div>}

        {f.length > 0 && <div><h3 style={P.secT}>Знахідки</h3>{f.map((x, i) => {
          const cc = confColor(x.confidence_level || 50);
          return <div key={x.id || i} style={P.fCard}>
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
              {x.slices && x.slices !== "-" && <span onClick={() => goToSlice(x.slices)} style={{ fontSize: 11, color: "#06b6d4", display: "flex", alignItems: "center", gap: 3, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}><Eye size={12} /> Зрізи: {x.slices} →</span>}
              {x.acuity && x.acuity !== "невизначено" && <span style={{ fontSize: 10, color: "#94a3b8", background: "rgba(255,255,255,.05)", padding: "1px 7px", borderRadius: 5 }}>{x.acuity}</span>}
            </div>
          </div>;
        })}</div>}

        {study?.radio?.length > 0 && <div style={{ marginTop: 10 }}><h3 style={P.secT}>Radiopaedia · Довідник</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{study.radio.map((t, i) => <a key={i} href={radioUrl(t)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#06b6d4", background: "rgba(6,182,212,.1)", border: "1px solid rgba(6,182,212,.2)", borderRadius: 7, padding: "4px 9px", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>{t} <ExternalLink size={10} /></a>)}</div>
        </div>}

        {/* ATTACHMENTS — MRI conclusion from imaging center */}
        <div style={{ marginTop: 16 }}>
          <h3 style={P.secT}><Paperclip size={14} style={{ marginRight: 4 }} />Заключення МРТ від центру</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => attachIn.current?.click()} style={{ ...P.sm, padding: "8px 14px", fontSize: 12, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.2)", color: "#f59e0b" }}>
              <Upload size={14} style={{ marginRight: 4 }} /> Додати файл (фото/PDF)
            </button>
            {(study?.attachments || []).length > 0 && (
              <button onClick={reviewConclusion} disabled={reviewLoading}
                style={{ ...P.sm, padding: "8px 14px", fontSize: 12, background: "rgba(139,92,246,.1)", border: "1px solid rgba(139,92,246,.2)", color: "#a78bfa" }}>
                {reviewLoading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Аналіз...</> : <><Brain size={14} style={{ marginRight: 4 }} /> ІІ оцінка заключення</>}
              </button>
            )}
            <input ref={attachIn} type="file" multiple accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => handleAttachment(e.target.files)} />
          </div>
          {(study?.attachments || []).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
              {study.attachments.map((att) => (
                <div key={att.id} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, overflow: "hidden", position: "relative" }}>
                  {att.type.startsWith("image/") ? (
                    <img src={att.data} alt={att.name} style={{ width: "100%", display: "block", cursor: "pointer", borderRadius: "8px 8px 0 0" }} onClick={() => setViewImg(att)} />
                  ) : (
                    <div onClick={() => { const w = window.open(); w.document.write(`<iframe src="${att.data}" style="width:100%;height:100vh;border:none"></iframe>`); }} style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "rgba(245,158,11,.06)" }}>
                      <FileText size={28} style={{ color: "#f59e0b" }} />
                    </div>
                  )}
                  <div style={{ padding: "4px 6px" }}>
                    <p style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</p>
                  </div>
                  <button onClick={async () => {
                    const upd = (study.attachments || []).filter(a => a.id !== att.id);
                    setStudy(p => ({ ...p, attachments: upd }));
                    try { await dbPut("studies", String(study.id), { ...study, attachments: upd }); } catch {}
                  }} style={{ position: "absolute", top: 3, right: 3, background: "rgba(0,0,0,.7)", border: "none", borderRadius: 4, padding: 2, color: "#ef4444", cursor: "pointer" }}><X size={10} /></button>
                </div>
              ))}
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
                      <p style={{ fontSize: 11, color: "#94a3b8" }}><span style={{ color: "#06b6d4" }}>ІІ:</span> {d.ai_says}</p>
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

        {/* ARCHIVE BUTTON */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => archiveStudy(study.id)} style={{ ...P.sm, padding: "10px 16px", fontSize: 12, flex: 1, justifyContent: "center", background: "rgba(139,92,246,.08)", border: "1px solid rgba(139,92,246,.18)", color: "#a78bfa" }}>
            <Archive size={14} style={{ marginRight: 4 }} /> В архів
          </button>
        </div>

        <div style={P.disc}><Shield size={14} style={{ color: "#475569", flexShrink: 0 }} /><p style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>Результати ІІ мають допоміжний характер. Остаточний діагноз ставить лікар.</p></div>
      </div>
    );
  };

  // ═══════════ RENDER ═══════════
  return (
    <div style={P.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:#070b14}@keyframes pulse-ring{0%{box-shadow:0 0 0 0 rgba(6,182,212,.4)}70%{box-shadow:0 0 0 18px rgba(6,182,212,0)}100%{box-shadow:0 0 0 0 rgba(6,182,212,0)}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0f172a}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}`}</style>
      {scr === "dash" && Dash()}{scr === "lib" && Lib()}{scr === "new" && New()}{scr === "split" && Split()}
      {scr === "radio" && <RadioScreen setScr={setScr} />}
      {scr === "loading" && Loading()}{scr === "results" && Results()}

      {showSet && <div style={P.ov} onClick={() => setShowSet(false)}><div style={P.pan} onClick={e => e.stopPropagation()}><h3 style={P.panT}>Налаштування</h3><label style={P.lb}>Gemini API Key</label><input type="password" value={apiKeyIn} onChange={e => setApiKeyIn(e.target.value)} placeholder="AIza..." style={P.inp} /><p style={P.ht}>Отримайте на <span style={{ color: "#06b6d4" }}>ai.google.dev</span></p>
        <label style={{ ...P.lb, marginTop: 14 }}>Модель ІІ</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => { setAiModel("gemini-2.5-pro"); try { localStorage.setItem("mri-model", "gemini-2.5-pro"); } catch {} }} style={{ ...P.sm, padding: "10px 12px", textAlign: "left", justifyContent: "flex-start", background: aiModel === "gemini-2.5-pro" ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", border: aiModel === "gemini-2.5-pro" ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.07)" }}>
            <div><p style={{ fontSize: 13, fontWeight: 600, color: aiModel === "gemini-2.5-pro" ? "#06b6d4" : "#e2e8f0" }}>Gemini 2.5 Pro {aiModel === "gemini-2.5-pro" && "✓"}</p><p style={{ fontSize: 10, color: "#64748b" }}>Найвища точність · рекомендовано для діагностики</p></div>
          </button>
          <button onClick={() => { setAiModel("gemini-2.5-flash"); try { localStorage.setItem("mri-model", "gemini-2.5-flash"); } catch {} }} style={{ ...P.sm, padding: "10px 12px", textAlign: "left", justifyContent: "flex-start", background: aiModel === "gemini-2.5-flash" ? "rgba(6,182,212,.14)" : "rgba(255,255,255,.04)", border: aiModel === "gemini-2.5-flash" ? "1px solid rgba(6,182,212,.3)" : "1px solid rgba(255,255,255,.07)" }}>
            <div><p style={{ fontSize: 13, fontWeight: 600, color: aiModel === "gemini-2.5-flash" ? "#06b6d4" : "#e2e8f0" }}>Gemini 2.5 Flash {aiModel === "gemini-2.5-flash" && "✓"}</p><p style={{ fontSize: 10, color: "#64748b" }}>Швидше та дешевше · для рутинного огляду</p></div>
          </button>
        </div>
        <button onClick={saveKey} style={{ ...P.pri, marginTop: 14 }}>Зберегти</button></div></div>}

      {viewImg && <div style={P.ov} onClick={() => setViewImg(null)}><div style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center" }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setViewImg(null)} style={P.clX}><X size={14} /></button>
        <img src={viewImg.data} alt="" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 7, objectFit: "contain" }} />
        <p style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 4 }}>{viewImg.name}</p>
        <input
          value={viewImg.caption || ""}
          onChange={e => {
            const cap = e.target.value;
            setViewImg(p => ({ ...p, caption: cap }));
            // Update in refs library
            setRefs(p => {
              const updated = {};
              for (const [zone, imgs] of Object.entries(p)) {
                updated[zone] = imgs.map(im => im.id === viewImg.id ? { ...im, caption: cap } : im);
              }
              return updated;
            });
          }}
          placeholder="Додати опис (наприклад: розрив ПКС, набряк кісткового мозку...)"
          style={{ ...P.inp, marginTop: 8, maxWidth: 500, textAlign: "center", fontSize: 12, background: "rgba(255,255,255,.08)" }}
          onClick={e => e.stopPropagation()}
        />
        {viewImg.caption && <p style={{ fontSize: 10, color: "#10b981", marginTop: 3 }}>✓ Опис збережено</p>}
      </div></div>}

      {showRefP && <div style={P.ov} onClick={() => setShowRefP(false)}><div style={P.refPan} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h3 style={P.panT}>Норма — {ZONES[study?.zone]?.ua}</h3><button onClick={() => setShowRefP(false)} style={P.clX}><X size={14} /></button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 6 }}>{(refs[study?.zone] || []).map((im, i) => <div key={im.id} style={{ position: "relative", borderRadius: 6, overflow: "hidden", cursor: "pointer", border: "1px solid rgba(255,255,255,.07)" }} onClick={() => { setShowRefP(false); setViewImg(im); }}><img src={im.data} alt="" style={{ width: "100%", display: "block" }} /><span style={P.thIdx}>{i + 1}</span></div>)}</div>
      </div></div>}

      {toast && <div style={P.toast}>{toast}</div>}
    </div>
  );
}

// ═══════════ STYLES ═══════════
const P = {
  app: { fontFamily: "'IBM Plex Sans',sans-serif", background: "#0c0e12", minHeight: "100vh", color: "#e8eaed" },
  pg: { margin: "0 auto", padding: "0 18px 72px" },
  hdr: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "#11141a", borderBottom: "1px solid rgba(255,255,255,.08)", marginBottom: 16, marginLeft: -18, marginRight: -18 },
  logo: { fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, letterSpacing: ".2px", color: "#e8eaed" },
  sub: { fontSize: 10, color: "#5f6672", marginTop: 1, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".5px" },
  iBtn: { background: "#1a1d24", border: "0.5px solid rgba(255,255,255,.08)", borderRadius: 6, padding: 8, color: "#8b919c", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  warn: { display: "flex", alignItems: "center", gap: 8, background: "rgba(224,169,59,.08)", border: "1px solid rgba(224,169,59,.18)", borderRadius: 6, padding: "10px 12px", marginBottom: 14, margin: "0 18px 14px" },
  ws: { fontSize: 11, color: "#8b919c", marginTop: 1 },
  body: { },
  g2: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 12 },
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 },
  act: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "14px", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer", alignItems: "flex-start" },
  aIc: { width: 36, height: 36, borderRadius: 6, background: "#15324a", color: "#4aa3df", display: "flex", alignItems: "center", justifyContent: "center" },
  aLb: { fontSize: 13, fontWeight: 500, color: "#e8eaed" },
  chips: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 },
  chipGroup: { },
  chipGLabel: { fontSize: 11, fontWeight: 500, color: "#8b919c", marginBottom: 6, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: ".5px", fontFamily: "'JetBrains Mono',monospace" },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 6, padding: "5px 10px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 },
  chN: { color: "#8b919c" }, chC: { color: "#4aa3df", fontFamily: "'JetBrains Mono',monospace", fontWeight: 500 },
  secT: { fontSize: 11, fontWeight: 500, color: "#8b919c", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".5px", fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 8 },
  sCard: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 6, padding: "11px 14px", marginBottom: 6 },
  sN: { fontSize: 13, fontWeight: 500, color: "#e8eaed" }, sM: { fontSize: 11, color: "#5f6672", marginTop: 2, fontFamily: "'JetBrains Mono',monospace" },
  top: { display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "#11141a", borderBottom: "1px solid rgba(255,255,255,.08)", marginBottom: 16, marginLeft: -18, marginRight: -18 },
  bk: { background: "none", border: "none", color: "#4aa3df", display: "flex", alignItems: "center", gap: 3, fontSize: 12, cursor: "pointer", padding: 0 },
  pT: { fontSize: 15, fontWeight: 500, color: "#e8eaed" },
  ztabs: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 },
  ztGroup: { },
  ztGLabel: { fontSize: 11, fontWeight: 500, color: "#8b919c", marginBottom: 6, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: ".5px", fontFamily: "'JetBrains Mono',monospace" },
  ztRow: { display: "flex", flexWrap: "wrap", gap: 5 },
  zt: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#8b919c", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 },
  ztOn: { background: "#15324a", border: "0.5px solid rgba(74,163,223,.4)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#4aa3df", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 },
  ztB: { fontSize: 9, background: "rgba(74,163,223,.2)", color: "#4aa3df", padding: "0 4px", borderRadius: 3, fontWeight: 500, fontFamily: "'JetBrains Mono',monospace" },
  subLabel: { fontSize: 10, color: "#5f6672", marginBottom: 3, marginTop: 6, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".3px" },
  upRow: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 12 },
  upC: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "16px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" },
  upL: { fontSize: 11, fontWeight: 500, color: "#8b919c" },
  iGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(90px,1fr))", gap: 5, marginBottom: 12 },
  thBox: { position: "relative", aspectRatio: "1", borderRadius: 6, overflow: "hidden" },
  th: { width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block", borderRadius: 6, border: "0.5px solid rgba(255,255,255,.08)" },
  thDel: { position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.75)", border: "none", borderRadius: 4, padding: 2, color: "#e24b4a", cursor: "pointer" },
  thIdx: { position: "absolute", bottom: 2, left: 2, background: "rgba(0,0,0,.75)", color: "#8b919c", fontSize: 8, padding: "1px 4px", borderRadius: 3, fontFamily: "'JetBrains Mono',monospace" },
  thPg: { position: "absolute", top: 2, left: 2, background: "rgba(155,140,219,.8)", color: "#fff", fontSize: 7, padding: "1px 3px", borderRadius: 3 },
  thClip: { position: "absolute", top: 2, left: 2, fontSize: 9, background: "rgba(78,201,155,.8)", borderRadius: 3, padding: "0 2px" },
  thCap: { position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,.82)", color: "#e8eaed", fontSize: 8, padding: "2px 3px", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  vDot: { position: "absolute", top: 2, right: 2, background: "rgba(74,163,223,.85)", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" },
  lb: { display: "block", fontSize: 10, fontWeight: 500, color: "#8b919c", marginBottom: 5, marginTop: 12, textTransform: "uppercase", letterSpacing: ".5px", fontFamily: "'JetBrains Mono',monospace" },
  inp: { width: "100%", background: "#13161c", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 6, padding: "10px 11px", fontSize: 13, color: "#e8eaed", outline: "none", fontFamily: "'IBM Plex Sans',sans-serif" },
  ht: { fontSize: 10, color: "#5f6672", marginTop: 4 },
  sel: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 6, padding: "8px 9px", fontSize: 11, color: "#8b919c", cursor: "pointer", textAlign: "left" },
  selOn: { background: "#15324a", border: "0.5px solid rgba(74,163,223,.4)", borderRadius: 6, padding: "8px 9px", fontSize: 11, color: "#4aa3df", cursor: "pointer", fontWeight: 500, textAlign: "left" },
  grpLabel: { fontSize: 11, fontWeight: 500, color: "#8b919c", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".5px", fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 6 },
  sq: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 5, padding: "6px 12px", fontSize: 11, color: "#8b919c", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" },
  sqOn: { background: "#15324a", border: "0.5px solid rgba(74,163,223,.4)", borderRadius: 5, padding: "6px 12px", fontSize: 11, color: "#4aa3df", cursor: "pointer", fontWeight: 500, fontFamily: "'JetBrains Mono',monospace" },
  drop: { border: "1px dashed rgba(255,255,255,.12)", borderRadius: 8, padding: "22px 12px", textAlign: "center", cursor: "pointer", marginBottom: 12, background: "#0f1217" },
  refBx: { background: "#13161c", border: "0.5px solid rgba(155,140,219,.18)", borderRadius: 8, padding: 9, marginTop: 5, marginBottom: 3 },
  lnk: { background: "none", border: "none", color: "#4aa3df", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 },
  mini: { width: 38, height: 38, objectFit: "cover", borderRadius: 4, border: "0.5px solid rgba(255,255,255,.08)", cursor: "pointer", flexShrink: 0 },
  more: { width: 38, height: 38, borderRadius: 4, background: "#1a1d24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#5f6672", flexShrink: 0 },
  anaBtn: { width: "100%", background: "#1d6ea8", border: "none", borderRadius: 8, padding: 13, fontSize: 14, fontWeight: 500, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "'IBM Plex Sans',sans-serif" },
  secBtn: { width: "100%", background: "#13161c", border: "0.5px solid rgba(155,140,219,.3)", borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 500, color: "#9b8cdb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'IBM Plex Sans',sans-serif", marginBottom: 7 },
  spPan: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 8, padding: 8, textAlign: "center" },
  spLb: { fontSize: 11, fontWeight: 500, color: "#8b919c", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".3px", fontFamily: "'JetBrains Mono',monospace" },
  spImg: { width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 6, cursor: "pointer", border: "0.5px solid rgba(255,255,255,.06)" },
  spE: { height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a3f47", fontSize: 12, background: "#0f1217", borderRadius: 6 },
  spNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  nv: { background: "#1a1d24", border: "0.5px solid rgba(255,255,255,.08)", borderRadius: 5, padding: "4px 8px", color: "#8b919c", cursor: "pointer" },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "68vh", textAlign: "center" },
  pulse: { width: 80, height: 80, borderRadius: "50%", background: "#15324a", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-ring 2s infinite", marginBottom: 18 },
  prB: { width: "78%", maxWidth: 260, height: 4, background: "#1a1d24", borderRadius: 2, overflow: "hidden", marginBottom: 8, marginLeft: "auto", marginRight: "auto" },
  prF: { height: "100%", background: "#4aa3df", borderRadius: 2, transition: "width .4s" },
  prT: { fontSize: 11, color: "#5f6672", fontFamily: "'JetBrains Mono',monospace" },
  resH: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "14px", marginBottom: 8 },
  bdLg: { fontSize: 11, fontWeight: 500, background: "#3a2e15", color: "#e0a93b", padding: "4px 10px", borderRadius: 4, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" },
  bdOk: { fontSize: 11, fontWeight: 500, background: "#15332a", color: "#4ec99b", padding: "4px 10px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" },
  rvBtn: { flex: 1, background: "#13161c", border: "0.5px solid rgba(155,140,219,.2)", borderRadius: 6, padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer", color: "#9b8cdb", fontSize: 12, fontWeight: 500, fontFamily: "'IBM Plex Sans',sans-serif" },
  repBtn: { flex: 1, background: "#13161c", border: "0.5px solid rgba(74,163,223,.2)", borderRadius: 6, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", color: "#4aa3df", fontSize: 12, fontWeight: 500, fontFamily: "'IBM Plex Sans',sans-serif" },
  sumC: { background: "#13161c", border: "0.5px solid rgba(155,140,219,.18)", borderRadius: 8, padding: 12, marginBottom: 8 },
  sumT: { fontSize: 11, fontWeight: 500, color: "#9b8cdb", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5, fontFamily: "'JetBrains Mono',monospace" },
  sumTx: { fontSize: 13, lineHeight: 1.6, color: "#c4c9d0" },
  fCard: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.07)", borderRadius: 8, padding: 12, marginBottom: 6 },
  disc: { display: "flex", alignItems: "flex-start", gap: 7, background: "#13161c", border: "0.5px solid rgba(255,255,255,.06)", borderRadius: 6, padding: "10px 12px", marginTop: 18 },
  ov: { position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 12 },
  pan: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "22px 18px", width: "92%", maxWidth: 380 },
  panT: { fontSize: 15, fontWeight: 500, color: "#e8eaed", marginBottom: 10 },
  pri: { width: "100%", background: "#1d6ea8", border: "none", borderRadius: 6, padding: 10, fontSize: 13, fontWeight: 500, color: "#fff", cursor: "pointer", marginTop: 8, fontFamily: "'IBM Plex Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center" },
  clX: { position: "absolute", top: -7, right: -7, background: "rgba(226,75,74,.85)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", zIndex: 10 },
  pdfPan: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 10, padding: 16, width: "95%", maxWidth: 900, maxHeight: "84vh", overflowY: "auto", position: "relative" },
  pdfCtrl: { display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginBottom: 8, padding: "6px 0", borderTop: "0.5px solid rgba(255,255,255,.06)", borderBottom: "0.5px solid rgba(255,255,255,.06)" },
  sm: { background: "#1a1d24", border: "0.5px solid rgba(255,255,255,.08)", borderRadius: 5, padding: "4px 8px", fontSize: 10, color: "#8b919c", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 },
  rIn: { width: 38, background: "#1a1d24", border: "0.5px solid rgba(255,255,255,.08)", borderRadius: 4, padding: "3px 5px", fontSize: 10, color: "#e8eaed", textAlign: "center", outline: "none" },
  pdfG: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))", gap: 6, marginBottom: 8 },
  pdfTh: { position: "relative", borderRadius: 6, overflow: "hidden", cursor: "pointer", transition: "border-color .15s" },
  pdfCh: { position: "absolute", top: 2, right: 2, background: "#4aa3df", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" },
  pdfN: { position: "absolute", bottom: 1, left: 1, background: "rgba(0,0,0,.7)", color: "#8b919c", fontSize: 8, padding: "0 3px", borderRadius: 2, fontFamily: "'JetBrains Mono',monospace" },
  refPan: { background: "#13161c", border: "0.5px solid rgba(255,255,255,.1)", borderRadius: 10, padding: 16, width: "95%", maxWidth: 800, maxHeight: "84vh", overflowY: "auto", position: "relative" },
  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#1d6ea8", color: "#fff", padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 500, zIndex: 200, boxShadow: "0 4px 16px rgba(0,0,0,.4)" },
};
