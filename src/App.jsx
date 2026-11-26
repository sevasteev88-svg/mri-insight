import React, { useContext, Suspense, lazy } from "react";
import { AppProvider, AppContext } from "./context/AppContext.jsx";
import { P } from "./styles/styles.js";

import { SettingsModal, ImageViewModal, ReportModal, RefPreviewModal } from "./components/Modals.jsx";
import { AuthModal } from "./components/AuthModal.jsx";
import { ConfirmModal } from "./components/ConfirmModal.jsx";

function triggerChunkRecoveryReload() {
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem("mri_chunk_reload_ts") || "0");
    if (now - last > 10000) {
      sessionStorage.setItem("mri_chunk_reload_ts", String(now));
      window.location.reload();
      return true;
    }
  } catch {}
  return false;
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    triggerChunkRecoveryReload();
  });
}

function lazyWithRetry(importer) {
  return lazy(() =>
    importer().catch((err) => {
      const msg = String(err?.message || err || "");
      const isChunkError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("ChunkLoadError");
      if (isChunkError && triggerChunkRecoveryReload()) {
        return new Promise(() => {});
      }
      throw err;
    })
  );
}

const Dash = lazyWithRetry(() => import("./components/Dash.jsx"));
const Lib = lazyWithRetry(() => import("./components/Lib.jsx"));
const NewStudy = lazyWithRetry(() => import("./components/NewStudy.jsx"));
const SplitScreen = lazyWithRetry(() => import("./components/SplitScreen.jsx"));
const RadioScreen = lazyWithRetry(() => import("./components/RadioScreen.jsx"));
const Loading = lazyWithRetry(() => import("./components/Loading.jsx"));
const Results = lazyWithRetry(() => import("./components/Results.jsx"));

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("AppErrorBoundary caught error:", error, info);
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || "Невідома помилка завантаження модуля";
      return (
        <div style={{ ...P.app, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#13161c", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: 22, textAlign: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" }}>
              Виникла помилка відображення
            </h3>
            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 16px" }}>
              {msg.includes("dynamically imported module")
                ? "Додаток оновився на сервері. Оновіть сторінку, щоб завантажити нову версію."
                : msg}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ ...P.pri, padding: "10px 18px", fontSize: 13 }}
            >
              Оновити сторінку
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { scr, setScr, toast, isLocked, setIsLocked } = useContext(AppContext);

  return (
    <div style={P.app}>
      <Suspense fallback={<div style={{ ...P.center, color: "#8b919c", fontSize: 13 }}>Завантаження...</div>}>
        {scr === "dash" && <Dash />}
        {scr === "lib" && <Lib />}
        {scr === "new" && <NewStudy />}
        {scr === "split" && <SplitScreen />}
        {scr === "radio" && <RadioScreen setScr={setScr} />}
        {scr === "loading" && <Loading />}
        {scr === "results" && <Results />}
      </Suspense>

      {/* Doctor Authentication & Lock Screen */}
      <AuthModal isLocked={isLocked} setIsLocked={setIsLocked} />

      {/* Shared Modals */}
      <SettingsModal />
      <ImageViewModal />
      <ReportModal />
      <RefPreviewModal />
      <ConfirmModal />

      {/* Global Toast Notification */}
      {toast && <div style={P.toast}>{toast}</div>}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppErrorBoundary>
        <AppContent />
      </AppErrorBoundary>
    </AppProvider>
  );
}
