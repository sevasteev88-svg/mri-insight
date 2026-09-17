/**
 * DICOM 3D Plane Intersection & Localizer (Scout) Line Calculations
 */

// Vector cross product: A x B
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

// Vector dot product: A . B
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Vector subtraction: A - B
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// Vector length
function norm(a) {
  return Math.sqrt(dot(a, a));
}

// Normalize vector
function normalize(a) {
  const len = norm(a);
  if (len < 1e-9) return [0, 0, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

/**
 * Calculates the localizer / scout line intersection of sourceSlice onto targetSlice.
 * 
 * @param {Object} targetSlice - The slice currently displayed where the line will be drawn
 * @param {Object} sourceSlice - The active slice in the other viewer whose position is being indicated
 * @param {string} targetPlane - Optional plane of target ("Sagittal", "Coronal", "Axial")
 * @param {string} sourcePlane - Optional plane of source ("Sagittal", "Coronal", "Axial")
 * @param {number} sourceIdx - Slice index (0-based)
 * @param {number} sourceTotal - Total slices in source series
 * @returns {Object|null} { x1, y1, x2, y2 } normalized [0, 1] relative to image dimensions, or null
 */
export function calculateLocalizerLine(targetSlice, sourceSlice, targetPlane, sourcePlane, sourceIdx = 0, sourceTotal = 1) {
  if (!targetSlice || !sourceSlice) return null;

  // 1. Try true 3D DICOM plane intersection if metadata is available
  const ipp1 = targetSlice.imagePositionPatient;
  const iop1 = targetSlice.imageOrientationPatient;
  const ps1 = targetSlice.ps;
  const rows1 = targetSlice.rows || 512;
  const cols1 = targetSlice.cols || 512;

  const ipp2 = sourceSlice.imagePositionPatient;
  const iop2 = sourceSlice.imageOrientationPatient;

  if (ipp1 && iop1 && iop1.length >= 6 && ipp2 && iop2 && iop2.length >= 6) {
    // Normal vector of source slice plane
    const rowCos2 = [iop2[0], iop2[1], iop2[2]];
    const colCos2 = [iop2[3], iop2[4], iop2[5]];
    const normal2 = normalize(cross(rowCos2, colCos2));

    // Direction vectors for target image rows and columns (scaled by pixel spacing if available)
    const dx = ps1 ? ps1[1] : 1.0; // col spacing (X in pixel coordinates)
    const dy = ps1 ? ps1[0] : 1.0; // row spacing (Y in pixel coordinates)

    const rowCos1 = [iop1[0], iop1[1], iop1[2]];
    const colCos1 = [iop1[3], iop1[4], iop1[5]];
    const normal1 = normalize(cross(rowCos1, colCos1));

    // If planes are parallel or nearly parallel (|dot(normal1, normal2)| > 0.92), do not draw intersection line
    const angleCos = Math.abs(dot(normal1, normal2));
    if (angleCos > 0.92) {
      return null;
    }

    // Plane equation of source slice: normal2 . (P - ipp2) = 0
    // In target coordinates: P(c, r) = ipp1 + c * dx * rowCos1 + r * dy * colCos1
    // => normal2 . (ipp1 - ipp2) + c * dx * (normal2 . rowCos1) + r * dy * (normal2 . colCos1) = 0
    // => A * c + B * r + C = 0
    const A = dx * dot(normal2, rowCos1);
    const B = dy * dot(normal2, colCos1);
    const C = dot(normal2, sub(ipp1, ipp2));

    // Find intersection points with the target image rectangle [0, cols1] x [0, rows1]
    const pts = [];
    const EPS = 1e-6;

    // Intersect with x = 0 (left edge): B*r + C = 0 => r = -C / B
    if (Math.abs(B) > EPS) {
      const r = -C / B;
      if (r >= -0.05 * rows1 && r <= 1.05 * rows1) {
        pts.push({ x: 0, y: Math.max(0, Math.min(rows1, r)) });
      }
    }

    // Intersect with x = cols1 (right edge): A*cols1 + B*r + C = 0 => r = -(C + A*cols1) / B
    if (Math.abs(B) > EPS) {
      const r = -(C + A * cols1) / B;
      if (r >= -0.05 * rows1 && r <= 1.05 * rows1) {
        pts.push({ x: cols1, y: Math.max(0, Math.min(rows1, r)) });
      }
    }

    // Intersect with y = 0 (top edge): A*c + C = 0 => c = -C / A
    if (Math.abs(A) > EPS) {
      const c = -C / A;
      if (c >= -0.05 * cols1 && c <= 1.05 * cols1) {
        pts.push({ x: Math.max(0, Math.min(cols1, c)), y: 0 });
      }
    }

    // Intersect with y = rows1 (bottom edge): A*c + B*rows1 + C = 0 => c = -(C + B*rows1) / A
    if (Math.abs(A) > EPS) {
      const c = -(C + B * rows1) / A;
      if (c >= -0.05 * cols1 && c <= 1.05 * cols1) {
        pts.push({ x: Math.max(0, Math.min(cols1, c)), y: rows1 });
      }
    }

    // Remove duplicates
    const uniquePts = [];
    for (const p of pts) {
      const isDup = uniquePts.some(u => Math.hypot(u.x - p.x, u.y - p.y) < 1.0);
      if (!isDup) uniquePts.push(p);
    }

    if (uniquePts.length >= 2) {
      return {
        x1: uniquePts[0].x / cols1,
        y1: uniquePts[0].y / rows1,
        x2: uniquePts[1].x / cols1,
        y2: uniquePts[1].y / rows1
      };
    }
  }

  // 2. Fallback heuristic for Orthogonal Planes (when IOP is absent or from web/non-standard DICOM)
  const tP = (targetPlane || "").toLowerCase();
  const sP = (sourcePlane || "").toLowerCase();

  const isTargetSag = tP.includes("sag");
  const isTargetCor = tP.includes("cor");
  const isTargetTra = tP.includes("tra") || tP.includes("ax");

  const isSourceSag = sP.includes("sag");
  const isSourceCor = sP.includes("cor");
  const isSourceTra = sP.includes("tra") || sP.includes("ax");

  // If same plane or unknown, no localizer line
  if ((isTargetSag && isSourceSag) || (isTargetCor && isSourceCor) || (isTargetTra && isSourceTra)) {
    return null;
  }

  // Compute normalized slice progress 0..1
  let progress = sourceTotal > 1 ? sourceIdx / (sourceTotal - 1) : 0.5;

  // If target is Sagittal and source is Coronal (or vice versa):
  // Coronal on Sagittal view: vertical line moving from anterior to posterior (X or Y)
  if (isTargetSag && isSourceCor) {
    const x = Math.max(0.05, Math.min(0.95, progress));
    return { x1: x, y1: 0, x2: x, y2: 1 };
  }
  // Sagittal on Coronal view: vertical line moving from lateral to medial (X)
  if (isTargetCor && isSourceSag) {
    const x = Math.max(0.05, Math.min(0.95, progress));
    return { x1: x, y1: 0, x2: x, y2: 1 };
  }

  // Axial on Sagittal view: horizontal line
  if (isTargetSag && isSourceTra) {
    const y = Math.max(0.05, Math.min(0.95, progress));
    return { x1: 0, y1: y, x2: 1, y2: y };
  }
  // Axial on Coronal view: horizontal line
  if (isTargetCor && isSourceTra) {
    const y = Math.max(0.05, Math.min(0.95, progress));
    return { x1: 0, y1: y, x2: 1, y2: y };
  }

  // Sagittal on Axial view: vertical line
  if (isTargetTra && isSourceSag) {
    const x = Math.max(0.05, Math.min(0.95, progress));
    return { x1: x, y1: 0, x2: x, y2: 1 };
  }
  // Coronal on Axial view: horizontal line
  if (isTargetTra && isSourceCor) {
    const y = Math.max(0.05, Math.min(0.95, progress));
    return { x1: 0, y1: y, x2: 1, y2: y };
  }

  return null;
}
