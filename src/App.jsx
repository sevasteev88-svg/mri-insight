import React, { useContext } from "react";
import { AppProvider, AppContext } from "./context/AppContext.jsx";
import { P } from "./styles/styles.js";

import Dash from "./components/Dash.jsx";
import Lib from "./components/Lib.jsx";
import NewStudy from "./components/NewStudy.jsx";
import SplitScreen from "./components/SplitScreen.jsx";
import RadioScreen from "./components/RadioScreen.jsx";
import Loading from "./components/Loading.jsx";
import Results from "./components/Results.jsx";
import { SettingsModal, ImageViewModal, ReportModal, RefPreviewModal } from "./components/Modals.jsx";

function AppContent() {
  const { scr, setScr, toast } = useContext(AppContext);

  return (
    <div style={P.app}>
      {scr === "dash" && <Dash />}
      {scr === "lib" && <Lib />}
      {scr === "new" && <NewStudy />}
      {scr === "split" && <SplitScreen />}
      {scr === "radio" && <RadioScreen setScr={setScr} />}
      {scr === "loading" && <Loading />}
      {scr === "results" && <Results />}

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
