import React, { useContext, Suspense, lazy } from "react";
import { AppProvider, AppContext } from "./context/AppContext.jsx";
import { P } from "./styles/styles.js";

import { SettingsModal, ImageViewModal, ReportModal, RefPreviewModal } from "./components/Modals.jsx";
import { AuthModal } from "./components/AuthModal.jsx";

const Dash = lazy(() => import("./components/Dash.jsx"));
const Lib = lazy(() => import("./components/Lib.jsx"));
const NewStudy = lazy(() => import("./components/NewStudy.jsx"));
const SplitScreen = lazy(() => import("./components/SplitScreen.jsx"));
const RadioScreen = lazy(() => import("./components/RadioScreen.jsx"));
const Loading = lazy(() => import("./components/Loading.jsx"));
const Results = lazy(() => import("./components/Results.jsx"));

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

      {/* Global Toast Notification */}
      {toast && <div style={P.toast}>{toast}</div>}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
