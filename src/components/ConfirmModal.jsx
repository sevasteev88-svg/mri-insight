import React, { useEffect } from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { AlertTriangle, HelpCircle, X } from "lucide-react";

export function ConfirmModal() {
  const { confirmDialog, setConfirmDialog } = React.useContext(AppContext);

  useEffect(() => {
    if (!confirmDialog) return;
    const onKey = (e) => {
      if (e.key === "Escape") setConfirmDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDialog, setConfirmDialog]);

  if (!confirmDialog) return null;

  const { title, message, confirmLabel = "Підтвердити", danger = false, onConfirm } = confirmDialog;

  return (
    <div style={{ ...P.ov, zIndex: 1000 }} onClick={() => setConfirmDialog(null)}>
      <div
        style={{
          ...P.mPan,
          width: "92%",
          maxWidth: 400,
          border: `1px solid ${danger ? "rgba(226,75,74,.3)" : "rgba(74,163,223,.3)"}`,
          boxShadow: "0 20px 45px rgba(0,0,0,.75)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: danger ? "rgba(226,75,74,.14)" : "rgba(74,163,223,.14)",
                color: danger ? "#e24b4a" : "#4aa3df",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {danger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
              {title || "Підтвердження дії"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setConfirmDialog(null)}
            style={{ background: "rgba(255,255,255,.06)", border: "none", borderRadius: 6, padding: 5, color: "#8b919c", cursor: "pointer", display: "flex" }}
          >
            <X size={15} />
          </button>
        </div>

        {message && (
          <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 18px" }}>
            {message}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={() => setConfirmDialog(null)}
            style={{ ...P.sm, padding: "8px 14px", fontSize: 12, color: "#cbd5e1" }}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDialog(null);
              if (onConfirm) onConfirm();
            }}
            style={{
              ...P.btn,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 600,
              background: danger ? "#e24b4a" : "#1d6ea8",
              borderColor: danger ? "#e24b4a" : "#1d6ea8",
              color: "#fff"
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
