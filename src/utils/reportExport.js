import { ZONES } from "../constants/anatomy.js";

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const sevLabel = (s) => ({ normal: "Норма", mild: "Легкий", moderate: "Помірний", severe: "Тяжкий" }[s] || s || "—");
const sevColor = (s) => ({ normal: "#22c55e", mild: "#eab308", moderate: "#f97316", severe: "#ef4444" }[s] || "#94a3b8");
const sevEmoji = (s) => ({ normal: "🟢", mild: "🟡", moderate: "🟠", severe: "🔴" }[s] || "⚪");
const confStyle = (c) => {
  if (c >= 80) return { bg: "rgba(34,197,94,.16)", c: "#15803d" };
  if (c >= 60) return { bg: "rgba(234,179,8,.18)", c: "#a16207" };
  return { bg: "rgba(239,68,68,.16)", c: "#b91c1c" };
};

export function openPrintableReport({ study, vnotes = {}, conclusionReview = null, type = "clinical", totalSlices = 0 }) {
  if (!study) return false;

  const f = (study.findings || []).filter((x) => x && !x._extra);
  const zone = ZONES[study.zone]?.ua || study.zone || "";
  const pn = study.patientName || "Невідомий";
  const date = study.mriDate || study.date || new Date().toLocaleDateString("uk-UA");
  const keyImages = (study.keyImages || []).filter((k) => k && (k.data || k.url));

  const validSeriesKeys = new Set(Object.keys(study.series || {}));
  const sliceNotes = Object.entries({ ...(study.vnotes || {}), ...(vnotes || {}) })
    .filter(([k, v]) => {
      if (!v || !v.trim()) return false;
      if (validSeriesKeys.size === 0) return true;
      const lastDash = k.lastIndexOf("-");
      const sKey = lastDash !== -1 ? k.substring(0, lastDash) : k;
      return validSeriesKeys.has(sKey) || (study.zone && sKey.startsWith(study.zone + "__"));
    });

  const sevCounts = { normal: 0, mild: 0, moderate: 0, severe: 0 };
  f.forEach((x) => { if (sevCounts[x.severity] !== undefined) sevCounts[x.severity]++; });
  const maxSev = f.length === 0 ? "normal" : (sevCounts.severe > 0 ? "severe" : sevCounts.moderate > 0 ? "moderate" : sevCounts.mild > 0 ? "mild" : "normal");
  const verdict = {
    normal: "Патології не виявлено",
    mild: "Незначні відхилення",
    moderate: "Помірні відхилення — потребує уваги",
    severe: "Значні відхилення — потребує лікування"
  }[maxSev];

  const rev = conclusionReview || study.conclusionReview;

  const printToolbar = `
    <div class="no-print" style="position:sticky;top:0;z-index:99;background:#0f172a;color:#f8fafc;padding:10px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;font-family:'Segoe UI',Arial,sans-serif">
      <div style="font-size:13px"><strong>MRI Insight</strong> · Попередній перегляд звіту (${type === "clinical" ? "Лікарський" : "Для тренера"})</div>
      <div style="display:flex;gap:8px">
        <button onclick="window.print()" style="background:#0891b2;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer">🖨️ Зберегти у PDF / Друк</button>
        <button onclick="window.close()" style="background:#334155;color:#e2e8f0;border:none;border-radius:6px;padding:7px 12px;font-size:12px;cursor:pointer">Закрити</button>
      </div>
    </div>`;

  let bodyHtml = "";

  if (type === "clinical") {
    const seqStr = Object.entries(study.series || {})
      .filter(([_, a]) => a.length > 0)
      .map(([s, a]) => `${escapeHtml(s)} (${a.length} зр.)`)
      .join(", ") || "—";

    bodyHtml = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:760px;margin:0 auto;padding:28px;color:#1e293b">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0891b2;padding-bottom:14px;margin-bottom:20px">
          <div>
            <h1 style="font-size:22px;margin:0;color:#0891b2">MRI Insight</h1>
            <p style="font-size:11px;color:#64748b;margin:2px 0 0">Клінічний звіт МРТ дослідження</p>
          </div>
          <div style="text-align:right">
            <p style="font-size:12px;color:#475569;margin:0">Дата дослідження: <strong>${escapeHtml(date)}</strong></p>
            ${study.age ? `<p style="font-size:11px;color:#64748b;margin:2px 0 0">Вік: ${escapeHtml(study.age)}</p>` : ""}
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e2e8f0">
          <tr><td style="padding:7px 12px;background:#f1f5f9;font-weight:600;width:180px;font-size:12px;border-bottom:1px solid #e2e8f0">Пацієнт</td><td style="padding:7px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">${escapeHtml(pn)}</td></tr>
          <tr><td style="padding:7px 12px;background:#f1f5f9;font-weight:600;font-size:12px;border-bottom:1px solid #e2e8f0">Зона дослідження</td><td style="padding:7px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(zone)}</td></tr>
          <tr><td style="padding:7px 12px;background:#f1f5f9;font-weight:600;font-size:12px;border-bottom:1px solid #e2e8f0">Послідовності / Зрізи</td><td style="padding:7px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${seqStr} · Усього зрізів: ${totalSlices}</td></tr>
          ${study.complaints ? `<tr><td style="padding:7px 12px;background:#f1f5f9;font-weight:600;font-size:12px;border-bottom:1px solid #e2e8f0">Скарги</td><td style="padding:7px 12px;font-size:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(study.complaints)}</td></tr>` : ""}
          ${study.mechanism ? `<tr><td style="padding:7px 12px;background:#f1f5f9;font-weight:600;font-size:12px">Механізм травми / Анамнез</td><td style="padding:7px 12px;font-size:12px">${escapeHtml(study.mechanism)}</td></tr>` : ""}
        </table>

        ${study.summary ? `<div style="background:#f0fdfa;border-left:4px solid #0891b2;padding:12px 16px;margin-bottom:14px;border-radius:0 8px 8px 0;break-inside:avoid"><h3 style="font-size:13px;color:#0891b2;margin:0 0 5px">Висновок ШІ</h3><p style="font-size:13px;line-height:1.55;margin:0;color:#334155">${escapeHtml(study.summary)}</p></div>` : ""}

        ${study.recommendation ? `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;margin-bottom:16px;border-radius:0 8px 8px 0;break-inside:avoid"><h3 style="font-size:13px;color:#3b82f6;margin:0 0 5px">Рекомендація</h3><p style="font-size:13px;line-height:1.55;margin:0;color:#334155">${escapeHtml(study.recommendation)}</p></div>` : ""}

        ${keyImages.length > 0 ? `
          <div style="margin:18px 0">
            <h3 style="font-size:14px;color:#1e293b;margin:0 0 10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">Ключові кадри патологій (${keyImages.length})</h3>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
              ${keyImages.map((kImg) => `
                <div style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:#0f172a;break-inside:avoid">
                  <img src="${kImg.data || kImg.url}" style="width:100%;max-height:220px;object-fit:contain;display:block;background:#000" />
                  <div style="padding:7px 10px;background:#f8fafc;color:#1e293b">
                    <p style="font-size:11px;font-weight:700;margin:0">${escapeHtml(kImg.seq || "")} ${escapeHtml(kImg.plane || "")} #${escapeHtml(kImg.sliceIdx)}</p>
                    ${kImg.note ? `<p style="font-size:11px;color:#475569;margin:3px 0 0;line-height:1.35">${escapeHtml(kImg.note)}</p>` : ""}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>` : ""}

        ${f.length > 0 ? `
          <h3 style="font-size:14px;color:#1e293b;margin:18px 0 10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px">Детальні знахідки (${f.length})</h3>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
            <thead>
              <tr style="background:#0891b2;color:#fff">
                <th style="padding:7px;text-align:left;width:28px">№</th>
                <th style="padding:7px;text-align:left">Структура</th>
                <th style="padding:7px;text-align:left">Опис</th>
                <th style="padding:7px;text-align:center;width:65px">Впевн.</th>
                <th style="padding:7px;text-align:center;width:72px">Тяжкість</th>
                <th style="padding:7px;text-align:center;width:70px">Зрізи</th>
              </tr>
            </thead>
            <tbody>
              ${f.map((x, i) => {
                const cc = confStyle(x.confidence_level || 50);
                const diffHtml = Array.isArray(x.differential) && x.differential.length > 0
                  ? `<div style="margin-top:4px;font-size:10px;color:#64748b"><em>Диф. діагноз:</em> ${x.differential.map((d) => `${escapeHtml(d.diagnosis)} (${escapeHtml(d.likelihood)})`).join("; ")}</div>`
                  : "";
                return `<tr style="border-bottom:1px solid #e2e8f0;break-inside:avoid;${i % 2 === 0 ? "background:#f8fafc" : ""}">
                  <td style="padding:6px 7px;vertical-align:top">${i + 1}</td>
                  <td style="padding:6px 7px;font-weight:600;vertical-align:top">${escapeHtml(x.structure)}</td>
                  <td style="padding:6px 7px;line-height:1.4;vertical-align:top">${escapeHtml(x.description)}${diffHtml}</td>
                  <td style="padding:6px 7px;text-align:center;vertical-align:top"><span style="background:${cc.bg};color:${cc.c};padding:2px 6px;border-radius:4px;font-weight:700;font-size:11px">${x.confidence_level ?? "?"}%</span></td>
                  <td style="padding:6px 7px;text-align:center;color:${sevColor(x.severity)};font-weight:600;vertical-align:top">${sevLabel(x.severity)}</td>
                  <td style="padding:6px 7px;text-align:center;vertical-align:top">${escapeHtml(x.slices || "—")}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>` : `<div style="text-align:center;padding:18px;background:#f0fdf4;border-radius:8px;margin:14px 0"><p style="font-size:15px;color:#16a34a;font-weight:600;margin:0">✓ Патології не виявлено</p></div>`}

        ${sliceNotes.length > 0 ? `
          <div style="margin:16px 0;break-inside:avoid">
            <h3 style="font-size:14px;color:#1e293b;margin:0 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px">Пошарові нотатки лікаря (${sliceNotes.length})</h3>
            ${sliceNotes.map(([k, text]) => `<p style="font-size:12px;margin:4px 0;color:#334155"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(text)}</p>`).join("")}
          </div>` : ""}

        ${study.doctorNotes?.trim() ? `
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:14px 0;break-inside:avoid">
            <h3 style="font-size:13px;color:#1e293b;margin:0 0 6px">Клінічна картка / Нотатки лікаря</h3>
            <p style="font-size:12px;line-height:1.5;margin:0;white-space:pre-wrap;color:#334155">${escapeHtml(study.doctorNotes.trim())}</p>
          </div>` : ""}

        ${study.doctorReport?.trim() ? `
          <div style="background:#faf5ff;border-left:4px solid #8b5cf6;border-radius:0 8px 8px 0;padding:12px 14px;margin:14px 0;break-inside:avoid">
            <h3 style="font-size:13px;color:#6d28d9;margin:0 0 6px">Офіційний протокол лікаря</h3>
            <p style="font-size:12px;line-height:1.55;margin:0;white-space:pre-wrap;color:#334155">${escapeHtml(study.doctorReport.trim())}</p>
          </div>` : ""}

        ${rev?.overall_comment ? `
          <div style="background:#f8fafc;border-left:4px solid #a855f7;padding:10px 14px;margin:14px 0;border-radius:0 8px 8px 0;break-inside:avoid">
            <h4 style="font-size:12px;color:#7e22ce;margin:0 0 4px">Порівняння з висновком МРТ центру (${escapeHtml(rev.overall_agreement)})</h4>
            <p style="font-size:12px;margin:0;color:#334155">${escapeHtml(rev.overall_comment)}</p>
          </div>` : ""}

        <div style="margin-top:26px;padding-top:10px;border-top:1px solid #e2e8f0">
          <p style="font-size:10px;color:#64748b;line-height:1.45;margin:0">⚕ Цей звіт створено за допомогою ІІ-аналізу та має виключно допоміжний характер. Остаточний діагноз ставить кваліфікований лікар на підставі повної клінічної картини.</p>
          <p style="font-size:9px;color:#94a3b8;margin:4px 0 0">MRI Insight · ${escapeHtml(date)} · Автоматичний PDF-експорт</p>
        </div>
      </div>`;
  } else {
    const barMax = Math.max(...Object.values(sevCounts), 1);
    const trainerFrames = keyImages.slice(0, 4);

    bodyHtml = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:660px;margin:0 auto;padding:28px;color:#1e293b">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #8b5cf6;padding-bottom:14px;margin-bottom:20px">
          <div><h1 style="font-size:22px;margin:0;color:#8b5cf6">MRI Insight</h1><p style="font-size:11px;color:#64748b;margin:2px 0 0">Звіт для тренера та команди реабілітації</p></div>
          <div style="text-align:right"><p style="font-size:12px;color:#64748b;margin:0">${escapeHtml(date)}</p></div>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:18px">
          <div style="flex:1"><p style="font-size:11px;color:#64748b;margin:0 0 2px">Спортсмен</p><p style="font-size:16px;font-weight:700;margin:0">${escapeHtml(pn)}</p></div>
          <div><p style="font-size:11px;color:#64748b;margin:0 0 2px">Зона</p><p style="font-size:16px;font-weight:700;margin:0">${escapeHtml(zone)}</p></div>
        </div>

        <div style="background:${sevColor(maxSev)}15;border:2px solid ${sevColor(maxSev)};border-radius:12px;padding:18px;text-align:center;margin-bottom:20px;break-inside:avoid">
          <p style="font-size:32px;margin:0">${sevEmoji(maxSev)}</p>
          <p style="font-size:19px;font-weight:700;color:${sevColor(maxSev)};margin:6px 0 4px">${verdict}</p>
          <p style="font-size:13px;color:#64748b;margin:0">${f.length === 0 ? "Відхилень не знайдено" : `Виявлено ${f.length} знахідок`}</p>
        </div>

        ${f.length > 0 ? `<h3 style="font-size:14px;margin:0 0 10px">Розподіл за тяжкістю</h3>
        <div style="margin-bottom:18px;break-inside:avoid">
          ${[["severe", "Тяжкі"], ["moderate", "Помірні"], ["mild", "Легкі"], ["normal", "Норма"]].map(([k, label]) =>
            `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;width:70px;color:#64748b">${label}</span>
              <div style="flex:1;height:18px;background:#f1f5f9;border-radius:4px;overflow:hidden">
                <div style="width:${(sevCounts[k] / barMax) * 100}%;height:100%;background:${sevColor(k)};border-radius:4px;min-width:${sevCounts[k] > 0 ? "20px" : "0"}"></div>
              </div>
              <span style="font-size:13px;font-weight:700;width:24px;text-align:right">${sevCounts[k]}</span>
            </div>`).join("")}
        </div>` : ""}

        ${study.summary ? `<div style="background:#f8fafc;border-radius:8px;padding:12px 14px;margin-bottom:14px;break-inside:avoid"><h3 style="font-size:13px;color:#8b5cf6;margin:0 0 5px">Що показало МРТ</h3><p style="font-size:13px;line-height:1.55;margin:0;color:#475569">${escapeHtml(study.summary)}</p></div>` : ""}

        ${trainerFrames.length > 0 ? `
          <h3 style="font-size:14px;margin:14px 0 8px">Ключові знімки (${trainerFrames.length})</h3>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">
            ${trainerFrames.map((kImg) => `
              <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;break-inside:avoid">
                <img src="${kImg.data || kImg.url}" style="width:100%;max-height:180px;object-fit:contain;background:#000;display:block" />
                <div style="padding:5px 8px;background:#f8fafc;font-size:11px;color:#334155"><strong>${escapeHtml(kImg.seq || "")} ${escapeHtml(kImg.plane || "")} #${escapeHtml(kImg.sliceIdx)}</strong>${kImg.note ? ` · ${escapeHtml(kImg.note)}` : ""}</div>
              </div>
            `).join("")}
          </div>` : ""}

        ${f.length > 0 ? `<h3 style="font-size:14px;margin:0 0 8px">Основні знахідки</h3>
        ${f.map((x) => `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding:9px 12px;background:#f8fafc;border-radius:8px;border-left:3px solid ${sevColor(x.severity)};break-inside:avoid">
          <span style="font-size:16px">${sevEmoji(x.severity)}</span>
          <div><p style="font-size:13px;font-weight:600;margin:0">${escapeHtml(x.structure)}</p><p style="font-size:12px;color:#64748b;margin:3px 0 0;line-height:1.4">${escapeHtml(x.description)}</p></div>
        </div>`).join("")}` : ""}

        ${study.recommendation ? `<div style="background:#f0fdfa;border-radius:8px;padding:12px 14px;margin-top:14px;break-inside:avoid"><h3 style="font-size:13px;color:#0891b2;margin:0 0 5px">Рекомендація</h3><p style="font-size:13px;line-height:1.55;margin:0;color:#475569">${escapeHtml(study.recommendation)}</p></div>` : ""}

        <div style="margin-top:26px;padding-top:10px;border-top:1px solid #e2e8f0">
          <p style="font-size:10px;color:#64748b;line-height:1.45;margin:0">⚕ Цей звіт створено ІІ-системою MRI Insight і має допоміжний характер. Рішення про повернення до тренувань приймає лікар.</p>
          <p style="font-size:9px;color:#94a3b8;margin:4px 0 0">MRI Insight · ${escapeHtml(date)}</p>
        </div>
      </div>`;
  }

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>МРТ Звіт — ${escapeHtml(pn)}</title><style>body{margin:0;background:#fff}@media print{.no-print{display:none!important}body{padding:0}}</style></head><body>${printToolbar}${bodyHtml}</body></html>`);
  w.document.close();
  return true;
}
