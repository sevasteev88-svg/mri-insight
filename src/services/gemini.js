import { GoogleGenAI } from "@google/genai";
import { buildContactSheets } from "../utils/contactSheet.js";

export const DEFAULT_MODEL = "gemini-4-hydrogen";
export const TRIAGE_MODEL = "gemini-3.5-flash-lite";

export const GEMINI_MODELS = [
  {
    id: "gemini-4-hydrogen",
    label: "Gemini 4 Hydrogen",
    badge: "GEMINI 4 HYDROGEN",
    desc: "Швидкий та точний · рекомендовано за замовчуванням"
  },
  {
    id: "gemini-4-neon",
    label: "Gemini 4 Neon",
    badge: "GEMINI 4 NEON",
    desc: "Максимальна точність · флагманська модель (Paid tier)"
  },
  {
    id: "gemini-4-argon",
    label: "Gemini 4 Argon",
    badge: "GEMINI 4 ARGON",
    desc: "Ефективний баланс швидкості та глибокого аналізу"
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    badge: "GEMINI 3.5 LITE",
    desc: "Найшвидша та найдешевша · для швидкого скринінгу"
  }
];

export function normalizeModelId(modelId) {
  if (!modelId || typeof modelId !== "string") return DEFAULT_MODEL;
  if (GEMINI_MODELS.some((m) => m.id === modelId)) return modelId;
  if (modelId === "gemini-2.5-pro" || modelId.includes("pro")) return "gemini-4-neon";
  if (modelId.startsWith("gemini-2.") || modelId.startsWith("gemini-1.")) return DEFAULT_MODEL;
  return DEFAULT_MODEL;
}

export function getModelBadge(modelId) {
  const normalized = normalizeModelId(modelId);
  return GEMINI_MODELS.find((m) => m.id === normalized)?.badge || "GEMINI 4 HYDROGEN";
}

function dataUrlToMediaBlock(dataUrl, fallbackMime = "image/jpeg") {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return null;

  const header = dataUrl.slice(0, commaIdx);
  const b64 = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64/i);
  const mime = (mimeMatch ? mimeMatch[1] : fallbackMime).toLowerCase();

  let type = "image";
  if (mime.includes("pdf")) type = "document";
  else if (mime.startsWith("audio/")) type = "audio";

  return { type, data: b64, mime_type: mime };
}

function extractOutputText(interaction) {
  if (!interaction) return "";
  if (typeof interaction.output_text === "string" && interaction.output_text.length > 0) {
    return interaction.output_text;
  }
  if (Array.isArray(interaction.steps)) {
    const texts = [];
    for (const step of interaction.steps) {
      if (step?.type === "model_output" && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part?.type === "text" && typeof part.text === "string") {
            texts.push(part.text);
          }
        }
      }
    }
    if (texts.length > 0) return texts.join("");
  }
  if (Array.isArray(interaction.outputs)) {
    const texts = [];
    for (const out of interaction.outputs) {
      if (out?.type === "text" && typeof out.text === "string") texts.push(out.text);
    }
    if (texts.length > 0) return texts.join("");
  }
  return "";
}

function parseJsonSafe(raw) {
  const clean = (raw || "").replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean);
}

/**
 * Core Gemini Interactions API wrapper.
 * Never passes deprecated parameters (temperature, top_p, top_k) or "minimal" thinking_level on Gemini 4.
 */
export async function runInteraction({
  apiKey,
  model,
  input,
  systemInstruction,
  responseSchema,
  thinkingLevel = "medium",
  previousInteractionId
}) {
  if (!apiKey) throw new Error("API ключ Gemini не вказано");
  const client = new GoogleGenAI({ apiKey });
  const targetModel = model === TRIAGE_MODEL ? TRIAGE_MODEL : normalizeModelId(model);

  const safeThinking =
    thinkingLevel === "minimal" && targetModel.startsWith("gemini-4")
      ? "low"
      : thinkingLevel;

  const params = {
    model: targetModel,
    input,
    generation_config: {
      thinking_level: safeThinking || "medium"
    }
  };

  if (systemInstruction) {
    params.system_instruction = systemInstruction;
  }
  if (previousInteractionId) {
    params.previous_interaction_id = previousInteractionId;
  }
  if (responseSchema) {
    params.response_format = {
      type: "text",
      mime_type: "application/json",
      schema: responseSchema
    };
  }

  const interaction = await client.interactions.create(params);
  return {
    text: extractOutputText(interaction),
    id: interaction.id || null
  };
}

// ═══════════ JSON SCHEMAS ═══════════

export const STUDY_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    reading_steps: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          structure: { type: "string" },
          description: { type: "string" },
          slices: { type: "string" },
          differential: {
            type: "array",
            items: {
              type: "object",
              properties: {
                diagnosis: { type: "string" },
                likelihood: { type: "string" }
              },
              required: ["diagnosis", "likelihood"]
            }
          },
          confidence_level: { type: "integer" },
          severity: { type: "string", enum: ["normal", "mild", "moderate", "severe"] },
          acuity: { type: "string", enum: ["гострий", "хронічний", "невизначено"] },
          pulse_sequence_hint: { type: "string" }
        },
        required: ["id", "structure", "description", "slices", "confidence_level", "severity"]
      }
    },
    summary: { type: "string" },
    recommendation: { type: "string" },
    radiopaedia_terms: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["findings", "summary", "recommendation", "radiopaedia_terms"]
};

export const TRIAGE_STUDY_SCHEMA = {
  type: "object",
  properties: {
    suspect_slices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          series_key: { type: "string" },
          slice_numbers: {
            type: "array",
            items: { type: "integer" }
          },
          reason: { type: "string" }
        },
        required: ["series_key", "slice_numbers"]
      }
    }
  },
  required: ["suspect_slices"]
};

export const SERIES_TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    suspect_slices: {
      type: "array",
      items: { type: "integer" }
    }
  },
  required: ["suspect_slices"]
};

export const SERIES_SCAN_SCHEMA = {
  type: "object",
  properties: {
    markers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slice: { type: "integer" },
          finding: { type: "string" }
        },
        required: ["slice", "finding"]
      }
    }
  },
  required: ["markers"]
};

export const ROI_ANATOMY_SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          structure: { type: "string" },
          reasoning: { type: "string" },
          id_confidence: { type: "integer" }
        },
        required: ["structure", "reasoning", "id_confidence"]
      }
    },
    id_confidence_overall: { type: "integer" },
    anatomy: {
      type: "object",
      properties: {
        description: { type: "string" },
        function: { type: "string" },
        origin: { type: "string" },
        insertion: { type: "string" },
        innervation: { type: "string" },
        segment_level: { type: "string" },
        nerve_relation: { type: "string" },
        lobe_region: { type: "string" },
        blood_supply: { type: "string" },
        typical_pathologies: { type: "string" }
      }
    },
    what_to_check: { type: "string" },
    uncertainty_note: { type: "string" }
  },
  required: ["candidates", "id_confidence_overall", "anatomy", "what_to_check"]
};

export const CONCLUSION_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    overall_agreement: { type: "string", enum: ["agree", "partial", "disagree"] },
    overall_comment: { type: "string" },
    details: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          center_says: { type: "string" },
          ai_says: { type: "string" },
          agreement: { type: "string", enum: ["agree", "disagree"] },
          comment: { type: "string" }
        },
        required: ["point", "center_says", "ai_says", "agreement", "comment"]
      }
    },
    missed_by_center: { type: "array", items: { type: "string" } },
    missed_by_ai: { type: "array", items: { type: "string" } },
    recommendation: { type: "string" }
  },
  required: ["overall_agreement", "overall_comment", "details", "missed_by_center", "missed_by_ai", "recommendation"]
};

// ═══════════ DOMAIN AI FUNCTIONS ═══════════

function sampleEvenly(arr, maxCount) {
  if (arr.length <= maxCount) return arr.map((item, idx) => ({ item, origIdx: idx }));
  const result = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i * (arr.length - 1)) / Math.max(1, maxCount - 1));
    if (!result.some((r) => r.origIdx === idx)) {
      result.push({ item: arr[idx], origIdx: idx });
    }
  }
  return result;
}

export async function analyzeStudy({
  apiKey,
  model,
  study,
  zoneName,
  usedSeqs,
  zrefs,
  zoneKb,
  pastCases,
  vnotes,
  sysPrompt,
  onProgress
}) {
  const totalSlices = usedSeqs.reduce((sum, key) => sum + (study.series[key]?.length || 0), 0);
  const selectedSlicesBySeries = {};

  if (totalSlices > 28) {
    onProgress?.({ s: "send", p: 25, label: "Етап 1/2: швидкий скринінг серій (контакт-листи)..." });

    const triageInput = [
      {
        type: "text",
        text: `Ти — асистент радіолога. Перед тобою оглядові контакт-листи МРТ (Зона: ${zoneName}).
Кожна клітинка підписана номером зрізу (#1, #2, ...).
Обери номери зрізів для кожної серії, де видно або підозрюється патологія, або які є найбільш інформативними для детальної діагностики у високій якості.
Поверни JSON зі списком series_key та масивом slice_numbers (1-based цілі числа).`
      }
    ];

    for (const seq of usedSeqs) {
      const imgs = study.series[seq] || [];
      if (imgs.length === 0) continue;

      // Cap at 48 tiles (3 sheets of 4x4) per series so inline payload stays compact
      const sampled = sampleEvenly(imgs, 48).map(({ item, origIdx }) => ({
        ...item,
        _originalIndex: origIdx + 1
      }));
      const sheets = await buildContactSheets(sampled, {
        cols: 4,
        rows: 4,
        tileSize: 256,
        labelPrefix: "#"
      });

      triageInput.push({ type: "text", text: `\nСерія "${seq}" (усього ${imgs.length} зрізів):` });
      for (const sh of sheets) {
        const block = dataUrlToMediaBlock(sh.dataUrl, "image/jpeg");
        if (block) triageInput.push(block);
      }
    }

    try {
      const { text } = await runInteraction({
        apiKey,
        model: TRIAGE_MODEL,
        input: triageInput,
        responseSchema: TRIAGE_STUDY_SCHEMA,
        thinkingLevel: "low"
      });
      const triage = parseJsonSafe(text);

      for (const entry of triage?.suspect_slices || []) {
        const key = entry?.series_key;
        const imgs = study.series[key];
        if (!imgs || !Array.isArray(entry.slice_numbers)) continue;
        if (!selectedSlicesBySeries[key]) selectedSlicesBySeries[key] = new Set();

        for (const num of entry.slice_numbers) {
          const idx0 = Math.max(0, Math.min(imgs.length - 1, Number(num) - 1));
          if (Number.isNaN(idx0)) continue;
          // Expand by +-1 neighbor for continuity
          for (let d = -1; d <= 1; d++) {
            const nIdx = idx0 + d;
            if (nIdx >= 0 && nIdx < imgs.length) selectedSlicesBySeries[key].add(nIdx);
          }
        }
      }
    } catch (triageErr) {
      console.warn("Stage-1 study triage fallback:", triageErr);
    }

    // Ensure every non-empty series has at least 3 representative slices
    for (const seq of usedSeqs) {
      const imgs = study.series[seq] || [];
      if (imgs.length === 0) continue;
      if (!selectedSlicesBySeries[seq] || selectedSlicesBySeries[seq].size === 0) {
        selectedSlicesBySeries[seq] = new Set(
          sampleEvenly(imgs, Math.min(4, imgs.length)).map((r) => r.origIdx)
        );
      }
    }

    // Cap total high-res slices across all series at 32
    const allPicked = [];
    for (const seq of usedSeqs) {
      const idxs = [...(selectedSlicesBySeries[seq] || [])].sort((a, b) => a - b);
      for (const idx of idxs) allPicked.push({ seq, idx });
    }
    if (allPicked.length > 32) {
      const capped = sampleEvenly(allPicked, 32).map((r) => r.item);
      for (const seq of usedSeqs) selectedSlicesBySeries[seq] = new Set();
      for (const p of capped) selectedSlicesBySeries[p.seq].add(p.idx);
    }
  } else {
    for (const seq of usedSeqs) {
      const imgs = study.series[seq] || [];
      selectedSlicesBySeries[seq] = new Set(imgs.map((_, i) => i));
    }
  }

  onProgress?.({
    s: "ai",
    p: 60,
    label: totalSlices > 28
      ? "Етап 2/2: детальний аналіз ключових зрізів..."
      : "ШІ аналізує зрізи..."
  });

  const input = [
    { type: "text", text: `Зона: ${zoneName}\nСерії: ${usedSeqs.join(", ")}\nЗагальна кількість зрізів: ${totalSlices}\n` }
  ];

  const ctx = [];
  if (study.age) ctx.push(`Вік: ${study.age}`);
  if (study.complaints) ctx.push(`Скарги: ${study.complaints}`);
  if (study.mechanism) ctx.push(`Механізм травми / анамнез: ${study.mechanism}`);
  if (ctx.length) {
    input.push({
      type: "text",
      text: `\n--- КЛІНІЧНИЙ КОНТЕКСТ ---\n${ctx.join("\n")}\nВраховуй цей контекст при діагностиці.\n`
    });
  }

  if (pastCases && pastCases.length > 0) {
    input.push({
      type: "text",
      text: `\n--- ПОПЕРЕДНІ ПІДТВЕРДЖЕНІ ВИПАДКИ (для контексту) ---\nЛікар підтвердив ${pastCases.length} попередніх випадків для цієї зони:\n`
    });
    pastCases.forEach((c, i) => {
      input.push({
        type: "text",
        text: `\nВипадок ${i + 1} (${c.date}):\nЗнахідки: ${JSON.stringify((c.findings || []).map((f) => ({ structure: f.structure, description: f.description, severity: f.severity })))}\nВисновок: ${c.summary}\n`
      });
    });
  }

  const ne = Object.entries(vnotes || {}).filter(([_, v]) => v && v.trim());
  if (ne.length) {
    input.push({
      type: "text",
      text: "\n--- НОТАТКИ ЛІКАРЯ ---\n" + ne.map(([k, v]) => `${k}: ${v.trim()}`).join("\n")
    });
  }

  if (zrefs && zrefs.length) {
    input.push({ type: "text", text: "\n--- РЕФЕРЕНСИ НОРМИ ---" });
    for (const r of zrefs.slice(0, 12)) {
      const block = dataUrlToMediaBlock(r.data, "image/jpeg");
      if (block) input.push(block);
    }
  }

  if (zoneKb && zoneKb.length > 0) {
    input.push({
      type: "text",
      text:
        "\n--- БАЗА ЗНАНЬ (діагностичні критерії для цієї зони) ---\n" +
        zoneKb.map((e) => `[${e.title}]\n${e.text}`).join("\n\n") +
        "\n\nВраховуй ці діагностичні критерії при аналізі знімків.\n"
    });
  }

  for (const seq of usedSeqs) {
    const imgs = study.series[seq] || [];
    const chosenIdxs = [...(selectedSlicesBySeries[seq] || [])].sort((a, b) => a - b);
    if (chosenIdxs.length === 0) continue;

    input.push({
      type: "text",
      text: `\n--- СЕРІЯ ${seq} (всього ${imgs.length}, передано ${chosenIdxs.length} зрізів у високій роздільності) ---`
    });
    for (const idx of chosenIdxs) {
      input.push({ type: "text", text: `${seq} зріз #${idx + 1}:` });
      const block = dataUrlToMediaBlock(imgs[idx]?.data, "image/jpeg");
      if (block) input.push(block);
    }
  }

  input.push({
    type: "text",
    text: "\nПроаналізуй передані серії та зрізи. У findings вказуй серію та точні номери зрізів (наприклад slices: 'T2_Sag: 3-5'). Порівняй з нормою, знайди ВСІ відхилення."
  });

  const { text } = await runInteraction({
    apiKey,
    model,
    input,
    systemInstruction: sysPrompt,
    responseSchema: STUDY_ANALYSIS_SCHEMA,
    thinkingLevel: "high"
  });

  onProgress?.({ s: "proc", p: 85, label: "Формування структурованого звіту..." });
  return parseJsonSafe(text);
}

export async function scanSeriesSlices({ apiKey, model, slices, zoneName, onStatus }) {
  if (!slices || slices.length === 0) return {};

  let targetIndices = slices.map((_, i) => i);

  if (slices.length > 20) {
    onStatus?.("Етап 1/2: огляд контакт-листів...");
    const sampled = sampleEvenly(slices, 48).map(({ item, origIdx }) => ({
      ...item,
      _originalIndex: origIdx
    }));
    const sheets = await buildContactSheets(sampled, {
      cols: 4,
      rows: 4,
      tileSize: 256,
      labelPrefix: "#"
    });

    const triageInput = [
      {
        type: "text",
        text: `Ти — ШІ-асистент рентгенолога. Перед тобою контакт-листи МРТ серії (Зона: ${zoneName}, усього ${slices.length} зрізів).
Кожен зріз підписаний 0-based індексом (#0, #1, ...).
Обери номери зрізів, де є найменша підозра на патологію, набряк, розрив, випіт або дегенеративні зміни.`
      }
    ];
    for (const sh of sheets) {
      const block = dataUrlToMediaBlock(sh.dataUrl, "image/jpeg");
      if (block) triageInput.push(block);
    }

    const picked = new Set();
    try {
      const { text } = await runInteraction({
        apiKey,
        model: TRIAGE_MODEL,
        input: triageInput,
        responseSchema: SERIES_TRIAGE_SCHEMA,
        thinkingLevel: "low"
      });
      const parsedTriage = parseJsonSafe(text);
      for (const rawIdx of parsedTriage?.suspect_slices || []) {
        const idx = Number(rawIdx);
        if (Number.isNaN(idx)) continue;
        for (let d = -1; d <= 1; d++) {
          const n = idx + d;
          if (n >= 0 && n < slices.length) picked.add(n);
        }
      }
    } catch (e) {
      console.warn("Series triage fallback:", e);
    }

    if (picked.size === 0) {
      for (const s of sampleEvenly(slices, 12)) picked.add(s.origIdx);
    }
    targetIndices = [...picked].sort((a, b) => a - b).slice(0, 24);
  }

  onStatus?.(slices.length > 20 ? "Етап 2/2: перевірка підозрілих зрізів..." : "Сканування серії...");

  const input = [
    {
      type: "text",
      text: `Ти — ШІ-асистент рентгенолога. Проаналізуй передані МРТ зрізи (Зона: ${zoneName}).
Кожен зріз підписано його точним 0-based індексом (Зріз N). Знайди зрізи з реальними ознаками патології (ігноруй артефакти руху). У відповіді вказуй саме ці 0-based індекси та стислий опис українською. Якщо патологій немає, поверни порожній масив markers.`
    }
  ];

  for (const idx of targetIndices) {
    input.push({ type: "text", text: `Зріз ${idx}:` });
    const block = dataUrlToMediaBlock(slices[idx]?.data, "image/jpeg");
    if (block) input.push(block);
  }

  const { text } = await runInteraction({
    apiKey,
    model,
    input,
    responseSchema: SERIES_SCAN_SCHEMA,
    thinkingLevel: "medium"
  });

  const parsed = parseJsonSafe(text);
  const markers = {};
  for (const m of parsed?.markers || []) {
    if (m.slice !== undefined && m.slice !== null && m.finding) {
      markers[m.slice] = m.finding;
    }
  }
  return markers;
}

export async function analyzeRoiRegion({
  apiKey,
  model,
  prompt,
  zoneAtlas,
  zoneRefs,
  zoneKb,
  fullSliceDataUrl,
  croppedDataUrl
}) {
  const input = [{ type: "text", text: prompt }];

  if (zoneAtlas && zoneAtlas.length > 0) {
    input.push({ type: "text", text: "\n--- АНАТОМІЧНИЙ АТЛАС (підписані структури для орієнтації) ---" });
    for (const a of zoneAtlas.slice(0, 12)) {
      const block = dataUrlToMediaBlock(a.data, "image/jpeg");
      if (block) input.push(block);
      if (a.label) input.push({ type: "text", text: `Підпис: ${a.label}` });
    }
  }

  if (zoneRefs && zoneRefs.length > 0) {
    input.push({ type: "text", text: "\n--- РЕФЕРЕНСИ НОРМИ (для порівняння) ---" });
    for (const r of zoneRefs.slice(0, 5)) {
      const block = dataUrlToMediaBlock(r.data, "image/jpeg");
      if (block) input.push(block);
    }
  }

  if (zoneKb && zoneKb.length > 0) {
    input.push({
      type: "text",
      text: "\n--- БАЗА ЗНАНЬ (діагностичні критерії) ---\n" + zoneKb.map((e) => `[${e.title}]\n${e.text}`).join("\n\n") + "\n"
    });
  }

  input.push({ type: "text", text: "\n--- ПОВНИЙ ЗРІЗ (для контексту) ---" });
  const fullBlock = dataUrlToMediaBlock(fullSliceDataUrl, "image/jpeg");
  if (fullBlock) input.push(fullBlock);

  input.push({ type: "text", text: "\n--- ВИДІЛЕНА ДІЛЯНКА (пріоритет аналізу) ---" });
  const cropBlock = dataUrlToMediaBlock(croppedDataUrl, "image/jpeg");
  if (cropBlock) input.push(cropBlock);

  const { text } = await runInteraction({
    apiKey,
    model,
    input,
    responseSchema: ROI_ANATOMY_SCHEMA,
    thinkingLevel: "medium"
  });

  return parseJsonSafe(text);
}

export async function askAnatomyQuestion({ apiKey, model, prompt }) {
  const { text } = await runInteraction({
    apiKey,
    model,
    input: [{ type: "text", text: prompt }],
    responseSchema: ROI_ANATOMY_SCHEMA,
    thinkingLevel: "low"
  });
  return parseJsonSafe(text);
}

export async function extractConclusionOcr({ apiKey, model, attachments }) {
  const input = [
    {
      type: "text",
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
    }
  ];

  for (const att of attachments) {
    const block = dataUrlToMediaBlock(att.data, att.type || "image/jpeg");
    if (block) input.push(block);
  }

  const { text } = await runInteraction({
    apiKey,
    model,
    input,
    thinkingLevel: "low"
  });
  return (text || "").trim();
}

export async function reviewCenterConclusion({ apiKey, model, study, zoneName, attachments }) {
  const input = [
    {
      type: "text",
      text: `Ти досвідчений радіолог. Тобі надано:
1. Заключення МРТ від діагностичного центру (фото або PDF)
2. Результати твого попереднього аналізу знімків цього пацієнта

Порівняй заключення центру зі своїми знахідками. Будь детальним, відповідай українською мовою.`
    },
    {
      type: "text",
      text: `\n--- РЕЗУЛЬТАТИ ІІ АНАЛІЗУ ---\nЗона: ${zoneName}\nЗнахідки: ${JSON.stringify(study.findings || [])}\nВисновок ІІ: ${study.summary || "немає"}\n`
    },
    { type: "text", text: "\n--- ЗАКЛЮЧЕННЯ ВІД ЦЕНТРУ ---" }
  ];

  for (const att of attachments) {
    const block = dataUrlToMediaBlock(att.data, att.type || "image/jpeg");
    if (block) input.push(block);
  }

  const { text } = await runInteraction({
    apiKey,
    model,
    input,
    responseSchema: CONCLUSION_REVIEW_SCHEMA,
    thinkingLevel: "high"
  });

  return parseJsonSafe(text);
}

export async function generateMedicalProtocol({ apiKey, model, study, zoneName, vnotes }) {
  const notes = Object.entries(vnotes || {})
    .filter(([_, v]) => v && v.trim())
    .map(([k, v]) => `- Зріз ${k}: ${v.trim()}`)
    .join("\n");

  const prompt = `Ти — головний лікар-рентгенолог. Твоє завдання — написати офіційний протокол МРТ-дослідження (українською мовою).
Зона дослідження: ${zoneName || "Невідома зона"}.
Пацієнт: ${study?.patientName || "Не вказано"}.
${study?.complaints ? `Скарги: ${study.complaints}` : ""}
${study?.mechanism ? `Механізм травми: ${study.mechanism}` : ""}

Ось чорнові нотатки та знахідки лікаря, зроблені під час перегляду знімків:
${notes || "Нотаток немає. Опиши абсолютну норму для цієї анатомічної зони."}

Вимоги до протоколу:
1. Офіційний медичний стиль.
2. Розділ "ОПИС" (структурований по всіх основних анатомічних компонентах зони). Якщо в нотатках є патологія — розгорнуто опиши її. Якщо про компонент нічого не сказано в нотатках — опиши його як норму.
3. Розділ "ВИСНОВОК" (короткий підсумок виявлених патологій або констатація норми).
Не пиши жодних вступних слів, видай ТІЛЬКИ готовий текст медичного протоколу.`;

  const { text } = await runInteraction({
    apiKey,
    model,
    input: prompt,
    thinkingLevel: "medium"
  });
  return (text || "").trim();
}

export async function transcribeMedicalAudio({ apiKey, audioBase64, mimeType, zoneName }) {
  const cleanMime = (mimeType || "audio/webm").split(";")[0].trim();
  const input = [
    {
      type: "text",
      text: `Ти — медичний асистент радіолога-ортопеда та лікаря спортивної медицини (зона дослідження: ${zoneName || "МРТ"}).
Розпізнай голос лікаря на аудіозаписі українською мовою та оформи текст акуратно з правильними розділовими знаками.
Зберігай точні медичні терміни та абревіатури: ПХЗ, ЗХЗ, МРТ, Т1, Т2, STIR, PD FS, меніск, Stoller, лабральний, ротаторна манжета, набряк кісткового мозку, мм, см².
Виведи ТІЛЬКИ розпізнаний текст без пояснень чи лапок. Якщо мовлення відсутнє, поверни порожній рядок.`
    },
    {
      type: "audio",
      data: audioBase64,
      mime_type: cleanMime
    }
  ];

  const { text } = await runInteraction({
    apiKey,
    model: DEFAULT_MODEL,
    input,
    thinkingLevel: "low"
  });
  return (text || "").trim();
}

export async function chatWithStudy({
  apiKey,
  model,
  message,
  studyContext,
  previousInteractionId,
  attachedSliceDataUrl,
  attachedSliceLabel
}) {
  const systemInstruction = `Ти — досвідчений ШІ-асистент лікаря-рентгенолога та спеціаліста спортивної медицини в системі MRI Insight.
Відповідай українською мовою: чітко, професійно, по суті, структуровано.
Допомагай з інтерпретацією знахідок, диференційною діагностикою, підготовкою плану реабілітації та повернення до спорту (RTP), а також із поясненням результатів пацієнту простою мовою (коли просять).
Не вигадуй дані, яких немає в контексті дослідження. Застерігай, коли потрібне клінічне зіставлення або додаткові послідовності.

--- КОНТЕКСТ ПОТОЧНОГО ДОСЛІДЖЕННЯ ---
${studyContext}`;

  const input = [{ type: "text", text: message }];
  if (attachedSliceDataUrl) {
    if (attachedSliceLabel) {
      input.push({ type: "text", text: `\n[Прикріплений активний зріз: ${attachedSliceLabel}]` });
    }
    const block = dataUrlToMediaBlock(attachedSliceDataUrl, "image/jpeg");
    if (block) input.push(block);
  }

  const { text, id } = await runInteraction({
    apiKey,
    model,
    input,
    systemInstruction,
    previousInteractionId,
    thinkingLevel: "medium"
  });

  return { text: (text || "").trim(), interactionId: id };
}
