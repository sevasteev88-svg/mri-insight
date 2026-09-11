import React from "react";
import { AppContext } from "../context/AppContext.jsx";
import { P } from "../styles/styles.js";
import { ZONES, SUBGROUPS, ZONE_GROUPS } from "../constants/anatomy.js";
import TI from "./TI.jsx";

export default function ZoneGroups({ renderZone, countFn }) {
  const { expandedSubs, setExpandedSubs } = React.useContext(AppContext);

  return (
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
}