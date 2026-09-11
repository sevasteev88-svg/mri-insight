import React from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { Brain } from "lucide-react";
import { ZONES } from "../constants/anatomy.js";

export default function Loading() {
  const { study, prog } = React.useContext(AppContext);

  return (
    <div style={P.pg}>
      <div style={P.center}>
        <div style={P.pulse}><Brain size={40} style={{ color: "#4aa3df" }} /></div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Аналіз МРТ</h2>
        <p style={{ fontSize: 13, color: "#8b919c", marginBottom: 20 }}>
          {study?.patientName || "Пацієнт"} · {ZONES[study?.zone]?.ua}
        </p>
        {prog && (
          <>
            <div style={P.prB}><div style={{ ...P.prF, width: `${prog.p}%` }} /></div>
            <p style={P.prT}>
              {prog.s === "send" ? "Відправка зображень..." : prog.s === "ai" ? "ШІ аналізує зрізи..." : "Формування звіту..."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}