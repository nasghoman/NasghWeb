// api/nasgh-targets.js

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    // ===== قراءة الـ body =====
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    let body = {};
    try {
      body = JSON.parse(bodyString || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const plantName = (body.plantName || "").trim();
    const stage = (body.stage || "").trim(); // vegetative | flowering | fruit-setting | harvest
    const soil = body.soil || null;

    if (!plantName || !stage) {
      return res
        .status(400)
        .json({ error: "plantName and stage are required" });
    }

    // نطبع شوي معلومات لنتأكد في اللوق
    console.log("Targets request:", { plantName, stage });

    // ===== 1) جدول ثابت لـ 10 نباتات =====
    const plantKey = normalizePlantName(plantName);
    const stageKey = normalizeStage(stage);

    const staticTargets = getStaticTargets(plantKey, stageKey);
    if (staticTargets) {
      return res.status(200).json({
        source: "static",
        plantKey,
        stage: stageKey,
        targets: staticTargets,
      });
    }

    // ===== 2) لو مو موجود في الجدول الثابت → نحاول نقرأه من Firebase =====
    const cached = await loadTargetsFromFirebase(plantKey, stageKey);
    if (cached && cached.targets) {
      return res.status(200).json({
        source: "cached",
        plantKey,
        stage: stageKey,
        targets: cached.targets,
      });
    }

    // ===== 3) لو ما لقيناه في Firebase → نخلي Gemini يولّد جدول مرة وحدة ونحفظه =====
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Missing GEMINI_API_KEY env var" });
    }

    const generated = await generateTargetsWithGemini({
      apiKey,
      plantName,
      stage: stageKey,
      soil,
    });

    if (!generated || !generated.targets) {
      return res
        .status(500)
        .json({ error: "Failed to generate targets with Gemini" });
    }

    // نحفظه في Firebase عشان المرة الجاية نرجّع نفس الأرقام
    await saveTargetsToFirebase(plantKey, stageKey, generated);

    return res.status(200).json({
      source: "gemini",
      plantKey,
      stage: stageKey,
      targets: generated.targets,
    });
  } catch (err) {
    console.error("nasgh-targets error:", err);
    return res.status(500).json({ error: "Server error", details: err + "" });
  }
}

/* ------------------------------------------------------------------ */
/*  دوال مساعدة                                                       */
/* ------------------------------------------------------------------ */

// نحاول نوحّد أسماء النباتات بالعربي والإنجليزي لنفس المفتاح
function normalizePlantName(name) {
  const n = name.toLowerCase().trim();

  if (n.includes("طماطم") || n.includes("tomato")) return "tomato";
  if (n.includes("خيار") || n.includes("cucumber")) return "cucumber";
  if (n.includes("فلفل") || n.includes("pepper")) return "pepper";
  if (n.includes("باذنجان") || n.includes("eggplant")) return "eggplant";
  if (n.includes("بطاط") || n.includes("potato")) return "potato";
  if (n.includes("ليمون") || n.includes("حمض") || n.includes("citrus"))
    return "citrus";
  if (n.includes("نخيل") || n.includes("تمر") || n.includes("date"))
    return "date-palm";
  if (n.includes("برسيم") || n.includes("alfalfa")) return "alfalfa";
  if (n.includes("عنب") || n.includes("grape")) return "grape";
  if (n.includes("خس") || n.includes("lettuce")) return "lettuce";

  // أي اسم جديد نرجعه بشكل "slug" للاستعمال في Firebase
  return n
    .replace(/[^\u0600-\u06FF\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

function normalizeStage(stage) {
  if (stage === "vegetative" || stage === "growth") return "vegetative";
  if (stage === "flowering") return "flowering";
  if (stage === "fruit-setting" || stage === "fruit") return "fruit-setting";
  if (stage === "harvest" || stage === "ripening") return "harvest";
  return stage;
}

/* ------------------------------------------------------------------ */
/*  جدول ثابت لـ 10 نباتات                                           */
/* ------------------------------------------------------------------ */

/**
 * ملاحظة مهمة:
 * الأرقام هنا تقريبية مبنية على مراجع زراعية عامة + خبرة عملية.
 * الأفضل تعدلونها لاحقاً مع مهندس زراعي حسب محاصيلكم في عُمان.
 */

// قوالب جاهزة للخضار (نفس القيم تُستخدم لأكثر من نبات)
const TEMPLATE_VEG_VEGETATIVE = {
  temp: { min: 20, max: 26 },
  moisture: { min: 60, max: 80 },
  ec: { min: 800, max: 1800 },
  ph: { min: 6.0, max: 7.0 },
  n: { min: 120, max: 180 },
  p: { min: 60, max: 100 },
  k: { min: 150, max: 220 },
  shs: { min: 70, max: 90 },
  humic: { min: 8, max: 20 },
};

const TEMPLATE_VEG_FLOWERING = {
  temp: { min: 20, max: 28 },
  moisture: { min: 55, max: 75 },
  ec: { min: 1200, max: 2200 },
  ph: { min: 6.0, max: 6.8 },
  n: { min: 100, max: 150 },
  p: { min: 70, max: 110 },
  k: { min: 180, max: 260 },
  shs: { min: 75, max: 90 },
  humic: { min: 8, max: 20 },
};

const TEMPLATE_VEG_FRUIT = {
  temp: { min: 20, max: 28 },
  moisture: { min: 55, max: 70 },
  ec: { min: 1500, max: 2500 },
  ph: { min: 6.0, max: 6.8 },
  n: { min: 80, max: 140 },
  p: { min: 80, max: 120 },
  k: { min: 200, max: 300 },
  shs: { min: 75, max: 90 },
  humic: { min: 8, max: 20 },
};

const TEMPLATE_VEG_HARVEST = {
  temp: { min: 18, max: 26 },
  moisture: { min: 50, max: 70 },
  ec: { min: 1200, max: 2200 },
  ph: { min: 6.0, max: 7.0 },
  n: { min: 60, max: 120 },
  p: { min: 60, max: 110 },
  k: { min: 180, max: 280 },
  shs: { min: 70, max: 90 },
  humic: { min: 8, max: 20 },
};

// حمضيات (ليمون) – تربة أخف قلوية ورطوبة أقل شوي
const TEMPLATE_CITRUS_VEG = {
  temp: { min: 18, max: 26 },
  moisture: { min: 55, max: 70 },
  ec: { min: 800, max: 1800 },
  ph: { min: 6.0, max: 7.5 },
  n: { min: 100, max: 160 },
  p: { min: 60, max: 100 },
  k: { min: 150, max: 230 },
  shs: { min: 70, max: 90 },
  humic: { min: 6, max: 18 },
};
const TEMPLATE_CITRUS_FLOWER = {
  ...TEMPLATE_CITRUS_VEG,
  moisture: { min: 55, max: 65 },
  k: { min: 180, max: 260 },
};
const TEMPLATE_CITRUS_FRUIT = {
  ...TEMPLATE_CITRUS_VEG,
  moisture: { min: 55, max: 65 },
  ec: { min: 1000, max: 2200 },
  k: { min: 200, max: 300 },
};
const TEMPLATE_CITRUS_HARVEST = {
  ...TEMPLATE_CITRUS_FRUIT,
  moisture: { min: 50, max: 65 },
};

// نخيل + محاصيل علفية نستخدم قيم أوسع شوية
const TEMPLATE_DATE = {
  vegetative: {
    temp: { min: 22, max: 32 },
    moisture: { min: 45, max: 65 },
    ec: { min: 1000, max: 2500 },
    ph: { min: 6.5, max: 8.0 },
    n: { min: 80, max: 140 },
    p: { min: 50, max: 90 },
    k: { min: 150, max: 250 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
  flowering: {
    temp: { min: 24, max: 34 },
    moisture: { min: 45, max: 60 },
    ec: { min: 1200, max: 2600 },
    ph: { min: 6.5, max: 8.0 },
    n: { min: 70, max: 130 },
    p: { min: 60, max: 100 },
    k: { min: 180, max: 260 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
  "fruit-setting": {
    temp: { min: 26, max: 36 },
    moisture: { min: 40, max: 60 },
    ec: { min: 1500, max: 3000 },
    ph: { min: 6.5, max: 8.0 },
    n: { min: 60, max: 120 },
    p: { min: 60, max: 100 },
    k: { min: 200, max: 320 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
  harvest: {
    temp: { min: 24, max: 34 },
    moisture: { min: 35, max: 55 },
    ec: { min: 1200, max: 2800 },
    ph: { min: 6.5, max: 8.0 },
    n: { min: 60, max: 110 },
    p: { min: 50, max: 90 },
    k: { min: 180, max: 300 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
};

// برسيم (alfalfa) مثال مبسّط
const TEMPLATE_ALFALFA = {
  vegetative: {
    temp: { min: 16, max: 26 },
    moisture: { min: 55, max: 75 },
    ec: { min: 800, max: 2000 },
    ph: { min: 6.5, max: 7.5 },
    n: { min: 80, max: 140 },
    p: { min: 60, max: 100 },
    k: { min: 150, max: 250 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
  flowering: {
    temp: { min: 18, max: 28 },
    moisture: { min: 55, max: 70 },
    ec: { min: 1000, max: 2200 },
    ph: { min: 6.5, max: 7.5 },
    n: { min: 70, max: 130 },
    p: { min: 60, max: 100 },
    k: { min: 180, max: 260 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
  "fruit-setting": {
    // نستخدم نفس قيم الـ flowering تقريباً
    temp: { min: 18, max: 28 },
    moisture: { min: 55, max: 70 },
    ec: { min: 1000, max: 2200 },
    ph: { min: 6.5, max: 7.5 },
    n: { min: 70, max: 130 },
    p: { min: 60, max: 100 },
    k: { min: 180, max: 260 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
  harvest: {
    temp: { min: 16, max: 26 },
    moisture: { min: 50, max: 70 },
    ec: { min: 800, max: 2000 },
    ph: { min: 6.5, max: 7.5 },
    n: { min: 70, max: 120 },
    p: { min: 60, max: 100 },
    k: { min: 170, max: 250 },
    shs: { min: 70, max: 90 },
    humic: { min: 6, max: 18 },
  },
};

// الخريطة الرئيسية: 10 نباتات
const STATIC_PLANT_TARGETS = {
  tomato: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  cucumber: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  pepper: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  eggplant: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  potato: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  lettuce: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  grape: {
    vegetative: TEMPLATE_VEG_VEGETATIVE,
    flowering: TEMPLATE_VEG_FLOWERING,
    "fruit-setting": TEMPLATE_VEG_FRUIT,
    harvest: TEMPLATE_VEG_HARVEST,
  },
  citrus: {
    vegetative: TEMPLATE_CITRUS_VEG,
    flowering: TEMPLATE_CITRUS_FLOWER,
    "fruit-setting": TEMPLATE_CITRUS_FRUIT,
    harvest: TEMPLATE_CITRUS_HARVEST,
  },
  "date-palm": TEMPLATE_DATE,
  alfalfa: TEMPLATE_ALFALFA,
};

function getStaticTargets(plantKey, stageKey) {
  const plant = STATIC_PLANT_TARGETS[plantKey];
  if (!plant) return null;
  const stage = plant[stageKey];
  if (!stage) return null;
  return stage;
}

/* ------------------------------------------------------------------ */
/*  تخزين / قراءة من Firebase (نفس الداتابيس اللي تستخدمه للقراءات)  */
/* ------------------------------------------------------------------ */

const FIREBASE_DB_URL =
  "https://nasgh-a7e3e-default-rtdb.europe-west1.firebasedatabase.app";

async function loadTargetsFromFirebase(plantKey, stageKey) {
  try {
    const url = `${FIREBASE_DB_URL}/plantTargets/${plantKey}/${stageKey}.json`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data;
  } catch (e) {
    console.warn("loadTargetsFromFirebase error:", e);
    return null;
  }
}

async function saveTargetsToFirebase(plantKey, stageKey, payload) {
  try {
    const url = `${FIREBASE_DB_URL}/plantTargets/${plantKey}/${stageKey}.json`;
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("saveTargetsToFirebase error:", e);
  }
}

/* ------------------------------------------------------------------ */
/*  استدعاء Gemini مرة واحدة للأنواع الجديدة                           */
/* ------------------------------------------------------------------ */

async function generateTargetsWithGemini({ apiKey, plantName, stage, soil }) {
  const prompt = `
أنت خبير زراعي. أعطني فقط جدول مدى مثالي لعناصر التربة (temp, moisture, ec, ph, n, p, k, shs, humic)
لنبات: "${plantName}"
وفي مرحلة: "${stage}".

- temp: درجة حرارة التربة (°م)
- moisture: رطوبة التربة %
- ec: التوصيل الكهربائي µS/cm
- ph: رقم الحموضة
- n, p, k: مغذيات كبرى mg/kg
- shs: مؤشر صحة التربة
- humic: مؤشر الهيوميك أسيد

أرجع لي JSON فقط بدون أي نص إضافي، بالشكل التالي بالضبط:

{
  "targets": {
    "temp":   { "min": 20, "max": 26 },
    "moisture": { "min": 60, "max": 80 },
    "ec":     { "min": 800, "max": 1800 },
    "ph":     { "min": 6.0, "max": 7.0 },
    "n":      { "min": 100, "max": 180 },
    "p":      { "min": 60, "max": 100 },
    "k":      { "min": 150, "max": 250 },
    "shs":    { "min": 70, "max": 90 },
    "humic":  { "min": 8,  "max": 20 }
  }
}

تأكد أن كل القيم أرقام فقط.
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-pro:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error("Gemini error:", json);
    return null;
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    // بعض المرات المودل يضيف ```json ... ``` فننظفها
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", e, text);
    return null;
  }
}
