export const ZONES = {
  knee: { ua: "Колінний суглоб", short: "Коліно", en: "knee", group: "joints" },
  hip: { ua: "Кульшовий суглоб", short: "Кульшовий", en: "hip", group: "joints" },
  ankle: { ua: "Гомілковостопний суглоб", short: "Гомілковостоп", en: "ankle", group: "joints" },
  shoulder: { ua: "Плечовий суглоб", short: "Плечовий", en: "shoulder", group: "joints" },
  elbow: { ua: "Ліктьовий суглоб", short: "Ліктьовий", en: "elbow", group: "joints" },
  wrist: { ua: "Променезап'ястковий суглоб", short: "Зап'ястковий", en: "wrist", group: "joints" },
  hand: { ua: "Кисть", short: "Кисть", en: "hand", group: "joints" },
  foot: { ua: "Стопа", short: "Стопа", en: "foot", group: "joints" },
  c_spine: { ua: "Шийний відділ хребта", short: "Шийний", en: "cervical spine", group: "spine" },
  t_spine: { ua: "Грудний відділ хребта", short: "Грудний", en: "thoracic spine", group: "spine" },
  l_spine: { ua: "Поперековий відділ хребта", short: "Поперековий", en: "lumbar spine", group: "spine" },
  head: { ua: "Голова (головний мозок)", short: "Голова", en: "brain head", group: "head" },

  cap_thigh: { ua: "М'язи стегна", short: "Стегно", en: "thigh muscles", group: "capture" },
  cap_calf: { ua: "М'язи гомілки", short: "Гомілка", en: "calf muscles", group: "capture" },
  cap_pelvis: { ua: "Таз / сідниці", short: "Таз", en: "pelvis gluteal", group: "capture" },
  cap_arm: { ua: "Плече / рука", short: "Плече", en: "arm muscles", group: "capture" },

  m_rectus_femoris: { ua: "Прямий м'яз стегна", short: "Прямий", en: "rectus femoris", group: "muscles", sub: "thigh_ant" },
  m_vastus_lat: { ua: "Латеральний широкий м'яз", short: "Лат. широкий", en: "vastus lateralis", group: "muscles", sub: "thigh_ant" },
  m_vastus_med: { ua: "Медіальний широкий м'яз", short: "Мед. широкий", en: "vastus medialis", group: "muscles", sub: "thigh_ant" },
  m_vastus_int: { ua: "Проміжний широкий м'яз", short: "Пром. широкий", en: "vastus intermedius", group: "muscles", sub: "thigh_ant" },
  m_biceps_fem: { ua: "Двоголовий м'яз стегна", short: "Двоголовий", en: "biceps femoris", group: "muscles", sub: "thigh_post" },
  m_semitend: { ua: "Напівсухожилковий м'яз", short: "Напівсухожилк.", en: "semitendinosus", group: "muscles", sub: "thigh_post" },
  m_semimemb: { ua: "Напівперетинчастий м'яз", short: "Напівперетинч.", en: "semimembranosus", group: "muscles", sub: "thigh_post" },
  m_adductor_long: { ua: "Довгий привідний м'яз", short: "Довгий прив.", en: "adductor longus", group: "muscles", sub: "thigh_med" },
  m_adductor_mag: { ua: "Великий привідний м'яз", short: "Великий прив.", en: "adductor magnus", group: "muscles", sub: "thigh_med" },
  m_gracilis: { ua: "Тонкий м'яз", short: "Тонкий", en: "gracilis", group: "muscles", sub: "thigh_med" },
  m_pectineus: { ua: "Гребінчастий м'яз", short: "Гребінчастий", en: "pectineus", group: "muscles", sub: "thigh_med" },
  m_gastroc: { ua: "Литковий м'яз", short: "Литковий", en: "gastrocnemius", group: "muscles", sub: "calf_post" },
  m_soleus: { ua: "Камбалоподібний м'яз", short: "Камбалопод.", en: "soleus", group: "muscles", sub: "calf_post" },
  m_tib_post: { ua: "Задній великогомілковий м'яз", short: "Задній в/гом.", en: "tibialis posterior", group: "muscles", sub: "calf_post" },
  m_flex_dig: { ua: "Довгий згинач пальців", short: "Згинач пальців", en: "flexor digitorum longus", group: "muscles", sub: "calf_post" },
  m_tib_ant: { ua: "Передній великогомілковий м'яз", short: "Передній в/гом.", en: "tibialis anterior", group: "muscles", sub: "calf_ant" },
  m_ext_dig: { ua: "Довгий розгинач пальців", short: "Розгинач пальців", en: "extensor digitorum longus", group: "muscles", sub: "calf_ant" },
  m_plantaris: { ua: "Підошовний м'яз", short: "Підошовний", en: "plantaris muscle", group: "muscles", sub: "calf_post" },
  m_peroneus: { ua: "Малогомілкові м'язи", short: "Малогомілкові", en: "peroneus", group: "muscles", sub: "calf_lat" },
  m_iliopsoas: { ua: "Клубово-поперековий м'яз", short: "Клубово-попер.", en: "iliopsoas", group: "muscles", sub: "pelvis" },
  m_glute_max: { ua: "Великий сідничний м'яз", short: "Вел. сідничний", en: "gluteus maximus", group: "muscles", sub: "pelvis" },
  m_glute_med: { ua: "Середній сідничний м'яз", short: "Сер. сідничний", en: "gluteus medius", group: "muscles", sub: "pelvis" },
  m_glute_min: { ua: "Малий сідничний м'яз", short: "Мал. сідничний", en: "gluteus minimus", group: "muscles", sub: "pelvis" },
  m_piriformis: { ua: "Грушоподібний м'яз", short: "Грушоподібний", en: "piriformis", group: "muscles", sub: "pelvis" },
  m_tfl: { ua: "Напружувач широкої фасції", short: "Напруж. фасції", en: "tensor fasciae latae", group: "muscles", sub: "pelvis" },
  m_biceps_br: { ua: "Двоголовий м'яз плеча", short: "Двоголовий", en: "biceps brachii", group: "muscles", sub: "arm" },
  m_brachialis: { ua: "Плечовий м'яз", short: "Плечовий", en: "brachialis", group: "muscles", sub: "arm" },
  m_triceps: { ua: "Триголовий м'яз плеча", short: "Триголовий", en: "triceps brachii", group: "muscles", sub: "arm" },
  m_deltoid: { ua: "Дельтоподібний м'яз", short: "Дельтоподібний", en: "deltoid muscle", group: "muscles", sub: "arm" },
  m_supraspin: { ua: "Надостьовий м'яз", short: "Надостьовий", en: "supraspinatus", group: "muscles", sub: "rotator" },
  m_infraspin: { ua: "Підостьовий м'яз", short: "Підостьовий", en: "infraspinatus", group: "muscles", sub: "rotator" },
  m_teres_min: { ua: "Малий круглий м'яз", short: "Малий круглий", en: "teres minor", group: "muscles", sub: "rotator" },
  m_subscap: { ua: "Підлопатковий м'яз", short: "Підлопатковий", en: "subscapularis", group: "muscles", sub: "rotator" },

  s_meniscus_med: { ua: "Медіальний меніск", short: "Мед. меніск", en: "medial meniscus", group: "structures", sub: "menisci" },
  s_meniscus_lat: { ua: "Латеральний меніск", short: "Лат. меніск", en: "lateral meniscus", group: "structures", sub: "menisci" },
  s_cartilage_knee: { ua: "Суглобовий хрящ коліна", short: "Хрящ коліна", en: "knee articular cartilage", group: "structures", sub: "cartilage" },
  s_cartilage_hip: { ua: "Суглобовий хрящ кульшового", short: "Хрящ кульш.", en: "hip articular cartilage", group: "structures", sub: "cartilage" },
  s_labrum_shoulder: { ua: "Губа плечового суглоба", short: "Губа плеча", en: "glenoid labrum", group: "structures", sub: "labrum" },
  s_labrum_hip: { ua: "Губа кульшового суглоба", short: "Губа кульш.", en: "acetabular labrum", group: "structures", sub: "labrum" },
  s_bursa_knee: { ua: "Сумки коліна (бурси)", short: "Бурси коліна", en: "knee bursae", group: "structures", sub: "bursae" },
  s_bursa_shoulder: { ua: "Субакроміальна сумка", short: "Субакр. сумка", en: "subacromial bursa", group: "structures", sub: "bursae" },
  s_bursa_hip: { ua: "Вертлюгова сумка", short: "Вертл. сумка", en: "trochanteric bursa", group: "structures", sub: "bursae" },

  l_acl: { ua: "Передня хрестоподібна зв'язка", short: "ПХЗ", en: "anterior cruciate ligament", group: "ligaments", sub: "knee_lig" },
  l_pcl: { ua: "Задня хрестоподібна зв'язка", short: "ЗХЗ", en: "posterior cruciate ligament", group: "ligaments", sub: "knee_lig" },
  l_mcl: { ua: "Медіальна колатеральна зв'язка", short: "МКЗ", en: "medial collateral ligament", group: "ligaments", sub: "knee_lig" },
  l_lcl: { ua: "Латеральна колатеральна зв'язка", short: "ЛКЗ", en: "lateral collateral ligament", group: "ligaments", sub: "knee_lig" },
  l_patellar: { ua: "Зв'язка наколінка", short: "Наколінок", en: "patellar ligament", group: "ligaments", sub: "knee_lig" },
  l_quad_tendon: { ua: "Сухожилля чотириголового м'яза", short: "Сухож. квадрицепса", en: "quadriceps tendon", group: "ligaments", sub: "knee_lig" },
  l_achilles: { ua: "Ахіллове сухожилля", short: "Ахілл", en: "achilles tendon", group: "ligaments", sub: "ankle_lig" },
  l_deltoid: { ua: "Дельтоподібна зв'язка", short: "Дельтоподібна", en: "deltoid ligament", group: "ligaments", sub: "ankle_lig" },
  l_atfl: { ua: "Передня таранно-малогомілкова зв'язка", short: "ПТМЗ", en: "anterior talofibular ligament", group: "ligaments", sub: "ankle_lig" },
  l_ptfl: { ua: "Задня таранно-малогомілкова зв'язка", short: "ЗТМЗ", en: "posterior talofibular ligament", group: "ligaments", sub: "ankle_lig" },
  l_cfl: { ua: "П'ятково-малогомілкова зв'язка", short: "ПМЗ", en: "calcaneofibular ligament", group: "ligaments", sub: "ankle_lig" },
  l_syndesmosis: { ua: "Синдесмоз (міжкісткова зв'язка)", short: "Синдесмоз", en: "ankle syndesmosis", group: "ligaments", sub: "ankle_lig" },
  l_plantar_fascia: { ua: "Підошовна фасція", short: "Плантарна фасція", en: "plantar fascia", group: "ligaments", sub: "ankle_lig" },
  l_peroneal_tendon: { ua: "Сухожилля малогомілкових м'язів", short: "Сухож. малогом.", en: "peroneal tendons", group: "ligaments", sub: "ankle_lig" },
  l_supraspin_tendon: { ua: "Сухожилля надостьового м'яза", short: "Сухож. надостьового", en: "supraspinatus tendon", group: "ligaments", sub: "shoulder_lig" },
  l_biceps_tendon: { ua: "Сухожилля довгої головки біцепса", short: "Сухож. біцепса", en: "long head biceps tendon", group: "ligaments", sub: "shoulder_lig" },
  l_subscap_tendon: { ua: "Сухожилля підлопаткового м'яза", short: "Сухож. підлопат.", en: "subscapularis tendon", group: "ligaments", sub: "shoulder_lig" },
  l_scapholunate: { ua: "Тригранно-півмісяцева зв'язка", short: "Скафолунарна", en: "scapholunate ligament", group: "ligaments", sub: "wrist_lig" },
  l_tfcc: { ua: "Трикутний фіброхрящовий комплекс (TFCC)", short: "TFCC", en: "triangular fibrocartilage complex", group: "ligaments", sub: "wrist_lig" },
  l_ucl_elbow: { ua: "Ліктьова колатеральна зв'язка", short: "ЛКЗ ліктя", en: "ulnar collateral ligament elbow", group: "ligaments", sub: "wrist_lig" },
};

export const SUBGROUPS = {
  thigh_ant: "Стегно — передня група",
  thigh_post: "Стегно — задня група",
  thigh_med: "Стегно — медіальна група",
  pelvis: "Таз / сідниці",
  calf_post: "Гомілка — задня група",
  calf_ant: "Гомілка — передня група",
  calf_lat: "Гомілка — латеральна група",
  arm: "Плече / рука",
  rotator: "Ротаторна манжета",
  menisci: "Меніски",
  cartilage: "Суглобовий хрящ",
  labrum: "Суглобова губа",
  bursae: "Синовіальні сумки (бурси)",
  knee_lig: "Зв'язки/сухожилля коліна",
  ankle_lig: "Зв'язки/сухожилля гомілковостопу",
  shoulder_lig: "Сухожилля/зв'язки плеча",
  wrist_lig: "Зв'язки зап'ястка / ліктя",
};

export const ZONE_GROUPS = {
  joints: { label: "Суглоби", icon: "ti-bone" },
  spine: { label: "Хребет", icon: "ti-spine" },
  head: { label: "Голова", icon: "ti-brain" },
  muscles: { label: "М'язи", icon: "ti-stretching" },
  structures: { label: "Структури суглобів", icon: "ti-circle-dot" },
  ligaments: { label: "Зв'язки та сухожилля", icon: "ti-link" },
};

export const CAPTURE_ZONES = {
  knee: "Колінний суглоб", hip: "Кульшовий суглоб", ankle: "Гомілковостопний суглоб",
  shoulder: "Плечовий суглоб", elbow: "Ліктьовий суглоб", wrist: "Зап'ястковий суглоб",
  hand: "Кисть", foot: "Стопа",
  c_spine: "Шийний відділ", t_spine: "Грудний відділ", l_spine: "Поперековий відділ",
  head: "Голова",
  cap_thigh: "М'язи стегна", cap_calf: "М'язи гомілки", cap_pelvis: "Таз / сідниці", cap_arm: "Плече / рука",
};

export const CAPTURE_GROUPS = {
  joints: { label: "Суглоби", icon: "ti-bone", zones: ["knee","hip","ankle","shoulder","elbow","wrist","hand","foot"] },
  spine: { label: "Хребет", icon: "ti-spine", zones: ["c_spine","t_spine","l_spine"] },
  head: { label: "Голова", icon: "ti-brain", zones: ["head"] },
  regions: { label: "М'язові ділянки", icon: "ti-stretching", zones: ["cap_thigh","cap_calf","cap_pelvis","cap_arm"] },
};

export const CAPTURE_RELATED = {
  cap_thigh: ["m_rectus_femoris","m_vastus_lat","m_vastus_med","m_vastus_int","m_biceps_fem","m_semitend","m_semimemb","m_adductor_long","m_adductor_mag","m_gracilis","m_pectineus"],
  cap_calf: ["m_gastroc","m_soleus","m_tib_post","m_flex_dig","m_tib_ant","m_ext_dig","m_plantaris","m_peroneus","l_achilles","l_plantar_fascia","l_peroneal_tendon"],
  cap_pelvis: ["m_iliopsoas","m_glute_max","m_glute_med","m_glute_min","m_piriformis","m_tfl","s_labrum_hip","s_bursa_hip"],
  cap_arm: ["m_biceps_br","m_brachialis","m_triceps","m_deltoid","m_supraspin","m_infraspin","m_teres_min","m_subscap","l_supraspin_tendon","l_biceps_tendon","l_subscap_tendon"],
  knee: ["l_acl","l_pcl","l_mcl","l_lcl","l_patellar","l_quad_tendon","s_meniscus_med","s_meniscus_lat","s_cartilage_knee","s_bursa_knee"],
  ankle: ["l_achilles","l_deltoid","l_atfl","l_ptfl","l_cfl","l_syndesmosis","l_plantar_fascia","l_peroneal_tendon"],
  shoulder: ["m_supraspin","m_infraspin","m_teres_min","m_subscap","l_supraspin_tendon","l_biceps_tendon","l_subscap_tendon","s_labrum_shoulder","s_bursa_shoulder"],
  hip: ["m_iliopsoas","m_glute_med","m_glute_min","m_piriformis","s_labrum_hip","s_cartilage_hip","s_bursa_hip"],
  wrist: ["l_scapholunate","l_tfcc"],
  elbow: ["l_ucl_elbow","m_biceps_br","m_triceps"],
};

export const SEQUENCES = ["T1", "T2", "STIR", "PD", "PD Fat Sat"];
export const PLANES = ["Sag", "Cor", "Ax"];
export const PLANE_LABELS = { Sag: "Сагітальна", Cor: "Коронарна", Ax: "Аксіальна" };

/**
 * Parses series key into { zone, seq, plane }
 * Key can be either:
 * - "knee__PD Fat Sat_Sag" (multi-zone / zone-aware)
 * - "PD Fat Sat_Sag" (legacy / single zone)
 */
export function parseSeriesKey(key, fallbackZone = "knee") {
  if (!key) return { zone: fallbackZone, seq: "T2", plane: "Sag" };
  let zone = fallbackZone;
  let rest = key;
  if (key.includes("__")) {
    const parts = key.split("__");
    zone = parts[0] || fallbackZone;
    rest = parts.slice(1).join("__");
  }
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore !== -1) {
    const seq = rest.substring(0, lastUnderscore);
    const plane = rest.substring(lastUnderscore + 1);
    return { zone, seq, plane };
  }
  return { zone, seq: rest, plane: "Sag" };
}

/**
 * Formats a clean human-readable label for a series key
 * e.g. "Коліно · PD Fat Sat Sag" or "PD Fat Sat Sag"
 */
export function formatSeriesLabel(key, showZone = false) {
  const { zone, seq, plane } = parseSeriesKey(key);
  const planeLabel = PLANE_LABELS[plane] ? plane : plane;
  const base = `${seq} ${planeLabel}`;
  if (showZone && zone && ZONES[zone]) {
    return `${ZONES[zone].short || ZONES[zone].ua} · ${base}`;
  }
  return base;
}

