import React, { useState } from 'react';

export default function ImageViewer({ 
  src, 
  alt, 
  style, 
  activeTool = "wl", // "wl", "pan", "roi"
  onWheelNav,
  onRoiDown,
  onRoiMove,
  onRoiUp,
  children // for overlays like ROI box
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [wl, setWl] = useState({ brightness: 1, contrast: 1 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || activeTool === 'pan') {
      // Zoom
      const zoomSensitivity = 0.05;
      const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
      setScale(s => Math.max(0.5, Math.min(s + delta, 5)));
    } else {
      // Navigate slices
      if (onWheelNav) onWheelNav(e.deltaY > 0 ? 1 : -1);
    }
  };

  const handleMouseDown = (e) => {
    if (activeTool === "roi") {
      if (onRoiDown) onRoiDown(e);
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (activeTool === "roi") {
      if (onRoiMove) onRoiMove(e);
      return;
    }

    if (!isDragging) return;
    
    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    
    if (activeTool === "pan") {
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (activeTool === "wl") {
      setWl(w => ({
        brightness: Math.max(0.1, Math.min(w.brightness + dx * 0.01, 3)),
        contrast: Math.max(0.1, Math.min(w.contrast - dy * 0.01, 3))
      }));
    }
    
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e) => {
    if (activeTool === "roi") {
      if (onRoiUp) onRoiUp(e);
      return;
    }
    setIsDragging(false);
  };
  
  const handleDoubleClick = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setWl({ brightness: 1, contrast: 1 });
  };

  return (
    <div 
      style={{ 
        ...style, 
        overflow: 'hidden', 
        position: 'relative',
        cursor: activeTool === 'pan' ? (isDragging ? 'grabbing' : 'grab') : activeTool === 'wl' ? 'ns-resize' : 'crosshair'
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {src ? (
        <img 
          src={src} 
          alt={alt} 
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            filter: `brightness(${wl.brightness}) contrast(${wl.contrast})`,
            pointerEvents: 'none',
            transformOrigin: 'center'
          }} 
        />
      ) : (
        <span style={{ color: "#3a3f47", display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>—</span>
      )}
      {children}
    </div>
  );
}
