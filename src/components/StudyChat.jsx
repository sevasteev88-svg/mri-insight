import React, { useState, useEffect, useRef } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { ZONES } from "../constants/anatomy.js";
import { chatWithStudy } from "../services/gemini.js";
import { MessageSquare, Send, Sparkles, RotateCcw, Copy, Image as ImageIcon } from "lucide-react";

const QUICK_PROMPTS = [
  "Пояснити пацієнту простою мовою",
  "План реабілітації та RTP (спорт)",
  "Диференційна діагностика",
  "Які додаткові обстеження потрібні?"
];

export default function StudyChat({
  compact = false,
  currentSliceDataUrl = null,
  currentSliceLabel = ""
}) {
  const { study, vnotes, conclusionReview, apiKey, aiModel, flash, setShowSet } = React.useContext(AppContext);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [interactionId, setInteractionId] = useState(null);
  const [attachSlice, setAttachSlice] = useState(Boolean(currentSliceDataUrl));
  const listEndRef = useRef(null);

  // Reset stateful conversation when switching to another study
  useEffect(() => {
    setMessages([]);
    setInteractionId(null);
  }, [study?.id]);

  // Keep default attach toggle synchronized if user switches to a view with/without slice
  useEffect(() => {
    if (!currentSliceDataUrl) setAttachSlice(false);
  }, [currentSliceDataUrl]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const buildStudyContext = () => {
    if (!study) return "Дані дослідження відсутні.";
    const lines = [
      `Пацієнт: ${study.patientName || "Не вказано"}`,
      `Зона: ${ZONES[study.zone]?.ua || study.zone || "Невідома"}`,
      study.age ? `Вік: ${study.age}` : null,
      study.date ? `Дата дослідження: ${study.mriDate || study.date}` : null,
      study.complaints ? `Скарги: ${study.complaints}` : null,
      study.mechanism ? `Анамнез / механізм травми: ${study.mechanism}` : null,
      study.summary ? `Висновок ШІ: ${study.summary}` : null,
      study.recommendation ? `Рекомендації ШІ: ${study.recommendation}` : null
    ].filter(Boolean);

    const findings = study.findings || [];
    if (findings.length > 0) {
      lines.push(
        "\nЗнахідки ШІ:\n" +
          findings
            .map(
              (f, i) =>
                `${i + 1}. [${f.severity || "?"} | ${f.confidence_level ?? "?"}%] ${f.structure} (зрізи: ${f.slices || "—"}): ${f.description}`
            )
            .join("\n")
      );
    }

    const sliceNotes = Object.entries(vnotes || {})
      .filter(([_, v]) => v && v.trim())
      .map(([k, v]) => `- ${k}: ${v.trim()}`);
    if (sliceNotes.length > 0) {
      lines.push("\nПошарові нотатки лікаря:\n" + sliceNotes.join("\n"));
    }

    if (study.doctorNotes?.trim()) {
      lines.push(`\nКлінічні нотатки / текст центру:\n${study.doctorNotes.trim()}`);
    }

    const rev = conclusionReview || study.conclusionReview;
    if (rev?.overall_comment) {
      lines.push(`\nОцінка заключення центру (${rev.overall_agreement}): ${rev.overall_comment}`);
    }

    return lines.join("\n");
  };

  const sendMessage = async (textOverride) => {
    const query = (textOverride ?? input).trim();
    if (!query || loading) return;

    if (!apiKey) {
      flash("Введіть Gemini API ключ у налаштуваннях");
      setShowSet(true);
      return;
    }

    const withSlice = Boolean(attachSlice && currentSliceDataUrl);
    const userMsg = {
      role: "user",
      text: query,
      sliceLabel: withSlice ? currentSliceLabel : null
    };

    setMessages((prev) => [...prev, userMsg]);
    if (textOverride === undefined) setInput("");
    setLoading(true);

    try {
      const { text, interactionId: nextId } = await chatWithStudy({
        apiKey,
        model: aiModel,
        message: query,
        studyContext: buildStudyContext(),
        previousInteractionId: interactionId,
        attachedSliceDataUrl: withSlice ? currentSliceDataUrl : null,
        attachedSliceLabel: withSlice ? currentSliceLabel : ""
      });
      if (nextId) setInteractionId(nextId);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: text || "Відповідь порожня. Спробуйте переформулювати питання." }
      ]);
    } catch (err) {
      console.error("StudyChat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: `Помилка: ${err.message || "Не вдалося отримати відповідь"}`, isError: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInteractionId(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: compact ? "100%" : 380,
        minHeight: compact ? 260 : 320,
        background: "#0d1016",
        borderRadius: compact ? 0 : 8,
        border: compact ? "none" : "0.5px solid rgba(255,255,255,.07)",
        overflow: "hidden"
      }}
    >
      {/* Top action bar inside chat */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "7px 10px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
          background: "#11151d"
        }}
      >
        <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 5 }}>
          <Sparkles size={12} color="#8b5cf6" /> Діалог по поточному дослідженню
        </span>
        {messages.length > 0 && (
          <button
            onClick={resetChat}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              gap: 3
            }}
            title="Почати новий діалог"
          >
            <RotateCcw size={11} /> Новий діалог
          </button>
        )}
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ padding: "8px 2px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 11, marginBottom: 10 }}>
              <MessageSquare size={14} color="#8b5cf6" />
              <span>Задайте питання щодо знахідок, тактики лікування або підготовки звіту:</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  style={{
                    background: "rgba(139,92,246,.1)",
                    border: "0.5px solid rgba(139,92,246,.28)",
                    color: "#c4b5fd",
                    borderRadius: 6,
                    padding: "6px 9px",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                background:
                  m.role === "user"
                    ? "rgba(74,163,223,.16)"
                    : m.isError
                      ? "rgba(226,75,74,.12)"
                      : "#161a23",
                border: `0.5px solid ${
                  m.role === "user"
                    ? "rgba(74,163,223,.32)"
                    : m.isError
                      ? "rgba(226,75,74,.32)"
                      : "rgba(255,255,255,.08)"
                }`,
                borderRadius: 8,
                padding: "8px 10px",
                color: m.isError ? "#fca5a5" : "#e2e8f0",
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap"
              }}
            >
              {m.sliceLabel && (
                <div style={{ fontSize: 10, color: "#38bdf8", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <ImageIcon size={10} /> {m.sliceLabel}
                </div>
              )}
              <div>{m.text}</div>
              {m.role === "ai" && !m.isError && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(m.text);
                      flash("Відповідь скопійовано");
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10
                    }}
                    title="Копіювати відповідь"
                  >
                    <Copy size={10} /> копіювати
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div
            style={{
              alignSelf: "flex-start",
              background: "#161a23",
              border: "0.5px solid rgba(139,92,246,.25)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 11,
              color: "#a78bfa"
            }}
          >
            ⏳ ШІ аналізує контекст дослідження...
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", padding: 8, background: "#11141b" }}>
        {currentSliceDataUrl && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              color: attachSlice ? "#38bdf8" : "#64748b",
              marginBottom: 6,
              cursor: "pointer",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={attachSlice}
              onChange={(e) => setAttachSlice(e.target.checked)}
              style={{ accentColor: "#38bdf8" }}
            />
            <ImageIcon size={11} /> Прикріпити поточний зріз ({currentSliceLabel || "активний"})
          </label>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Запитати ШІ по дослідженню..."
            rows={2}
            style={{
              ...P.inp,
              flex: 1,
              margin: 0,
              padding: "7px 9px",
              fontSize: 12,
              background: "#0b0e14",
              resize: "none",
              lineHeight: 1.4
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              ...P.sm,
              height: 36,
              padding: "0 12px",
              background: "#8b5cf6",
              border: "none",
              color: "#fff",
              opacity: loading || !input.trim() ? 0.5 : 1
            }}
            title="Надіслати (Enter)"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
