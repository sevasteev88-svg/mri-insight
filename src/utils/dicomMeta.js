import { ZONES } from "../constants/anatomy.js";

/**
 * Parses DICOM date string (YYYYMMDD) or Date object into DD.MM.YYYY
 */
export function formatDicomDate(raw) {
  if (!raw) return "";
  if (Array.isArray(raw)) raw = raw[0];
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const d = String(raw.getDate()).padStart(2, "0");
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const y = raw.getFullYear();
    return `${d}.${m}.${y}`;
  }
  const str = String(raw).trim();
  // 1. Strict 8 digits YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    return `${str.substring(6, 8)}.${str.substring(4, 6)}.${str.substring(0, 4)}`;
  }
  // 2. ISO / dot format YYYY-MM-DD or YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[3].padStart(2, "0")}.${isoMatch[2].padStart(2, "0")}.${isoMatch[1]}`;
  }
  // 3. DD.MM.YYYY
  const dmMatch = str.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (dmMatch) {
    return `${dmMatch[1].padStart(2, "0")}.${dmMatch[2].padStart(2, "0")}.${dmMatch[3]}`;
  }
  // 4. English date string from Daikon/JS e.g. 'Sat Aug 23 2008' or 'Aug 23 2008'
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const engMatch = str.match(/(?:[A-Za-z]+,?\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (engMatch && months[engMatch[1].toLowerCase()]) {
    return `${engMatch[2].padStart(2, "0")}.${months[engMatch[1].toLowerCase()]}.${engMatch[3]}`;
  }
  const parsedD = Date.parse(str);
  if (!isNaN(parsedD)) {
    const dObj = new Date(parsedD);
    const d = String(dObj.getDate()).padStart(2, "0");
    const m = String(dObj.getMonth() + 1).padStart(2, "0");
    const y = dObj.getFullYear();
    return `${d}.${m}.${y}`;
  }
  return str;
}

/**
 * Parses DICOM age string (e.g. "035Y", "042Y", "18M") into human readable "35 р."
 */
export function formatDicomAge(raw) {
  if (!raw) return "";
  if (Array.isArray(raw)) raw = raw[0];
  const str = String(raw).trim();
  const match = str.match(/0*(\d+)\s*([YyMmDd]?)/);
  if (match && match[1]) {
    const num = match[1];
    const unit = (match[2] || "Y").toUpperCase();
    if (unit === "M") return `${num} міс.`;
    if (unit === "D") return `${num} дн.`;
    return `${num} р.`;
  }
  return str;
}

/**
 * Detects matching ZONES key based on DICOM body part / study description / series description
 */
export function detectAnatomyZone(text, fallback = null) {
  if (!text || typeof text !== "string") return fallback;
  const t = text.toLowerCase();

  // Spine
  if (t.includes("cerv") || t.includes("c-spin") || t.includes("c_spin") || t.includes("шейн") || t.includes("шийн")) return "c_spine";
  if (t.includes("thorac") || t.includes("t-spin") || t.includes("t_spin") || t.includes("грудн")) return "t_spine";
  if (t.includes("lumb") || t.includes("l-spin") || t.includes("l_spin") || t.includes("поперек") || t.includes("пояснич") || t.includes("sacr")) return "l_spine";
  if (t.includes("spin") || t.includes("хребет") || t.includes("позвоноч")) return "l_spine";

  // Head / Brain
  if (t.includes("brain") || t.includes("head") || t.includes("голов") || t.includes("мозок") || t.includes("мозг") || t.includes("cerebr")) return "head";

  // Ankle / Foot
  if (t.includes("ankle") || t.includes("голеностоп") || t.includes("гомілковостоп") || t.includes("гомилковостоп") || t.includes("гомілково-стоп") || t.includes("talocrur") || t.includes("calcane") || t.includes("malleol") || t.includes("tars") || t.includes("astragal")) return "ankle";
  if (t.includes("foot") || t.includes("стоп") || t.includes("пед") || t.includes("pes ") || t.includes("pedis")) return "foot";

  // Knee
  if (t.includes("knee") || t.includes("колен") || t.includes("колін") || t.includes("art.genu") || t.includes("genu") || t.includes("patell") || t.includes("menisc")) return "knee";

  // Shoulder
  if (t.includes("shoulder") || t.includes("плеч") || t.includes("art.humer") || t.includes("humerus") || t.includes("glenoid") || t.includes("rotator")) return "shoulder";

  // Hip / Pelvis
  if (t.includes("hip") || t.includes("кульшов") || t.includes("тазобедр") || t.includes("art.coxae") || t.includes("coxa")) return "hip";
  if (t.includes("pelvis") || t.includes("таз") || t.includes("sacroiliac") || t.includes("крестц")) return "cap_pelvis";

  // Arm / Elbow / Wrist / Hand
  if (t.includes("elbow") || t.includes("локт") || t.includes("лікт") || t.includes("art.cubiti") || t.includes("cubit")) return "elbow";
  if (t.includes("wrist") || t.includes("запяст") || t.includes("зап'яст") || t.includes("art.radiocarp") || t.includes("carpal")) return "wrist";
  if (t.includes("hand") || t.includes("кист") || t.includes("кисть") || t.includes("manus")) return "hand";
  if (t.includes("thigh") || t.includes("бедр") || t.includes("стегн") || t.includes("femur")) return "cap_thigh";
  if (t.includes("calf") || t.includes("голен") || t.includes("гомілк") || t.includes("crus") || t.includes("tibia")) return "cap_calf";

  return fallback;
}

/**
 * Extracts comprehensive metadata from a Daikon Image object
 */
export function extractDicomMetadata(image) {
  const meta = {
    patientName: "",
    birthDate: "",
    age: "",
    sex: "",
    studyDate: "",
    bodyPart: "",
    studyDescription: "",
    seriesDescription: "",
    seriesInstanceUid: "",
    seriesNumber: "",
    detectedZone: null
  };

  try {
    // Patient Name (0010, 0010)
    const pNameTag = image.getTag(0x0010, 0x0010);
    if (pNameTag && pNameTag.value && pNameTag.value[0]) {
      meta.patientName = pNameTag.value[0].toString().replace(/\^/g, " ").trim();
    }

    // Birth Date (0010, 0030)
    const dobTag = image.getTag(0x0010, 0x0030);
    if (dobTag && dobTag.value && dobTag.value[0] !== undefined) {
      meta.birthDate = formatDicomDate(dobTag.value[0]);
    }

    // Patient Age (0010, 1010)
    const ageTag = image.getTag(0x0010, 0x1010);
    if (ageTag && ageTag.value && ageTag.value[0] !== undefined) {
      meta.age = formatDicomAge(ageTag.value[0]);
    }

    // Patient Sex (0010, 0040)
    const sexTag = image.getTag(0x0010, 0x0040);
    if (sexTag && sexTag.value && sexTag.value[0] !== undefined) {
      meta.sex = sexTag.value[0].toString().trim().toUpperCase();
    }

    // Study Date (0008, 0020)
    const sDateTag = image.getTag(0x0008, 0x0020);
    if (sDateTag && sDateTag.value && sDateTag.value[0] !== undefined) {
      meta.studyDate = formatDicomDate(sDateTag.value[0]);
    }

    // Body Part Examined (0018, 0015)
    const bpTag = image.getTag(0x0018, 0x0015);
    if (bpTag && bpTag.value && bpTag.value[0]) {
      meta.bodyPart = bpTag.value[0].toString().trim();
    }

    // Study Description (0008, 1030)
    const sdTag = image.getTag(0x0008, 0x1030);
    if (sdTag && sdTag.value && sdTag.value[0]) {
      meta.studyDescription = sdTag.value[0].toString().trim();
    }

    // Series Description (0008, 103E)
    const seTag = image.getTag(0x0008, 0x103E);
    if (seTag && seTag.value && seTag.value[0]) {
      meta.seriesDescription = seTag.value[0].toString().trim();
    }

    // Series Instance UID (0020, 000E)
    const suidTag = image.getTag(0x0020, 0x000E);
    if (suidTag && suidTag.value && suidTag.value[0]) {
      meta.seriesInstanceUid = suidTag.value[0].toString().trim();
    }

    // Series Number (0020, 0011)
    const snumTag = image.getTag(0x0020, 0x0011);
    if (snumTag && snumTag.value && snumTag.value[0] !== undefined) {
      meta.seriesNumber = snumTag.value[0].toString().trim();
    }

    // Detect zone from combined text
    const combinedAnatomy = `${meta.bodyPart} ${meta.studyDescription} ${meta.seriesDescription}`;
    meta.detectedZone = detectAnatomyZone(combinedAnatomy);

  } catch (err) {
    console.warn("DICOM metadata extraction warning:", err);
  }

  return meta;
}
