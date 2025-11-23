// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ================== تخزين مؤقت في الذاكرة ==================
let soilReadings = [];   // قراءات خام
let soilSessions = [];   // جلسات كاملة (قراءة + أهداف + توصية)

// تخزين القيم اللي يولدها Gemini للنباتات الجديدة
let dynamicTargets = {};

// ================== دوال مساعدة لـ Gemini ==================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGeminiUrl(model = "gemini-1.5-flash") {
  return (
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    model +
    ":generateContent?key=" +
    GEMINI_API_KEY
  );
}

async function callGeminiText(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const res = await fetch(getGeminiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Gemini error:", text);
    throw new Error("Gemini API error");
  }

  const data = await res.json();
  const reply =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0].text;

  return reply || "";
}

// نفس الشي لكن متوقع JSON
async function callGeminiJson(prompt) {
  const text = await callGeminiText(prompt);
  try {
    // ناخذ أول بلوك JSON داخل النص لو فيه كلام زيادة
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON parse from Gemini failed:", e.message, text);
    throw new Error("Invalid JSON from Gemini");
  }
}

// ================== قاعدة بيانات ثابتة لـ 10 نباتات ==================
// الأرقام تقريبية وعامة، لكن ثابتة في الكود (ما تتغير من Gemini).
// نفس القيم تقريبًا لكل المراحل كبداية.
const BASE_GENERIC = {
  temp: { min: 18, max: 26 },
  moisture: { min: 55, max: 65 },
  ec: { min: 800, max: 2200 },
  ph: { min: 6.0, max: 7.5 },
  n: { min: 100, max: 160 },
  p: { min: 60, max: 100 },
  k: { min: 200, max: 300 },
  shs: { min: 70, max: 90 },
  humic: { min: 6, max: 18 },
};

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

const PLANT_DB = {
  tomato: {
    displayName: "طماطم",
    aliases: ["طماطم", "طماطة", "tomato"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  cucumber: {
    displayName: "خيار",
    aliases: ["خيار", "cucumber"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  lemon: {
    displayName: "ليمون",
    aliases: ["ليمون", "lemon"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  date: {
    displayName: "نخيل تمر",
    aliases: ["نخيل", "نخيل تمر", "نخل", "date palm"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  lettuce: {
    displayName: "خس",
    aliases: ["خس", "lettuce"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  pepper: {
    displayName: "فلفل",
    aliases: ["فلفل", "فلفل حلو", "فلفل رومي", "pepper"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  eggplant: {
    displayName: "باذنجان",
    aliases: ["باذنجان", "eggplant"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  strawberry: {
    displayName: "فراولة",
    aliases: ["فراولة", "strawberry"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  olive: {
    displayName: "زيتون",
    aliases: ["زيتون", "olive"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
  grape: {
    displayName: "عنب",
    aliases: ["عنب", "grape"],
    stages: {
      vegetative: clone(BASE_GENERIC),
      flowering: clone(BASE_GENERIC),
      "fruit-setting": clone(BASE_GENERIC),
      harvest: clone(BASE_GENERIC),
    },
  },
};

function resolvePlantKey(nameRaw) {
  if (!nameRaw) return null;
  const name = String(nameRaw).toLowerCase().trim();

  for (const [key, cfg] of Object.entries(PLANT_DB)) {
    if (cfg.aliases.some((a) => a.toLowerCase() === name)) return key;
  }

  // لو ما لقي متطابق كامل، جرّب يحتوي
  for (const [key, cfg] of Object.entries(PLANT_DB)) {
    if (cfg.aliases.some((a) => name.includes(a.toLowerCase()))) return key;
  }

  return null;
}

// ================== REST API ==================

// ESP32 أو الفرونت يرسل قراءة خام
app.post("/api/soil-data", (req, res) => {
  const data = req.body;

  if (!data) {
    return res.status(400).json({ error: "No data" });
  }

  if (!data.timestamp) {
    data.timestamp = new Date().toISOString();
  }

  if (!data.stage) data.stage = "غير محددة";
  if (!data.advice) data.advice = "";

  soilReadings.unshift(data);
  soilReadings = soilReadings.slice(0, 100);

  return res.json({ ok: true });
});

// آخر قراءة
app.get("/api/soil-data", (req, res) => {
  if (!soilReadings.length) {
    return res.json({});
  }
  return res.json(soilReadings[0]);
});

// آخر ١٠ قراءات
app.get("/api/soil-history", (req, res) => {
  const limit = parseInt(req.query.limit || "10", 10);
  const lastN = soilReadings.slice(0, limit);
  return res.json(lastN);
});

// ================== حفظ جلسة كاملة (قراءة + أهداف + توصية) ==================

app.post("/api/soil-session", (req, res) => {
  const session = req.body || {};

  if (!session.soil) {
    return res.status(400).json({ error: "soil is required" });
  }

  const id = "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);

  const fullSession = {
    id,
    createdAt: session.createdAt || new Date().toISOString(),
    soil: session.soil,
    plantName: session.plantName || null,
    stage: session.stage || null,
    targets: session.targets || null,
    statusSummary: session.statusSummary || null,
    advice: session.advice || "",
  };

  soilSessions.unshift(fullSession);
  soilSessions = soilSessions.slice(0, 100);

  return res.json({ ok: true, id });
});

// للداشبورد لاحقًا
app.get("/api/soil-sessions", (req, res) => {
  const limit = parseInt(req.query.limit || "20", 10);
  return res.json(soilSessions.slice(0, limit));
});

// ================== /api/nasgh-targets ==================
// يرجع المدى المثالي لكل عنصر لنبات/مرحلة معينة.
// إذا النبات من الـ 10 الثابتين → يرجع من PLANT_DB.
// إذا نبات جديد → يطلب من Gemini مرّة واحدة ويحفظه في dynamicTargets.

app.post("/api/nasgh-targets", async (req, res) => {
  try {
    const { plantName, stage, soil } = req.body || {};

    if (!plantName || !stage) {
      return res.status(400).json({ error: "plantName and stage are required" });
    }

    const stageKey = String(stage).trim();
    const plantKeyFixed = resolvePlantKey(plantName);
    const normalizedKey =
      plantKeyFixed || String(plantName).toLowerCase().replace(/\s+/g, "_");

    // 1) لو في الـ 10 النباتات الثابتة
    if (plantKeyFixed && PLANT_DB[plantKeyFixed].stages[stageKey]) {
      return res.json({
        plantKey: plantKeyFixed,
        targets: PLANT_DB[plantKeyFixed].stages[stageKey],
        from: "static",
      });
    }

    // 2) لو Gemini سبق وولد له قيم
    if (
      dynamicTargets[normalizedKey] &&
      dynamicTargets[normalizedKey][stageKey]
    ) {
      return res.json({
        plantKey: normalizedKey,
        targets: dynamicTargets[normalizedKey][stageKey],
        from: "cache",
      });
    }

    // 3) نبات جديد → نطلب من Gemini
    const soilSnippet = soil ? JSON.stringify(soil) : "{}";

    const prompt = `
أنت خبير تغذية نباتية. أريد منك فقط قيم أرقام مثالية لعناصر التربة لنبات معين ومرحلة نمو محددة.

اسم النبات: "${plantName}"
مرحلة النمو (بالعربي أو إنجليزي): "${stageKey}"

إن احتجت، هذه قراءة تربة تقريبية (للإطلاع فقط):
${soilSnippet}

أعد لي فقط JSON صالح بدون أي كلام إضافي وبدون تعليقات، بالشكل التالي بالضبط:

{
  "temp":   { "min": 18, "max": 26 },
  "moisture": { "min": 55, "max": 65 },
  "ec":     { "min": 800, "max": 2200 },
  "ph":     { "min": 6.0, "max": 7.5 },
  "n":      { "min": 100, "max": 160 },
  "p":      { "min": 60, "max": 100 },
  "k":      { "min": 200, "max": 300 },
  "shs":    { "min": 70, "max": 90 },
  "humic":  { "min": 6, "max": 18 }
}

مع مراعاة نوع النبات والمرحلة، لكن أبقِ القيم ضمن نطاقات منطقية وقريبة من المثال.
`;

    const targets = await callGeminiJson(prompt);

    if (!dynamicTargets[normalizedKey]) dynamicTargets[normalizedKey] = {};
    dynamicTargets[normalizedKey][stageKey] = targets;

    return res.json({
      plantKey: normalizedKey,
      targets,
      from: "gemini",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "failed to compute targets",
      details: err.message,
    });
  }
});

// ================== /api/nasgh-ai ==================
// يرجع توصية نصية مرتبطة بقراءة التربة + ملخص الحالة من الجدول.

app.post("/api/nasgh-ai", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).send("GEMINI_API_KEY is not set");
    }

    const { soil, language, recommendationContext } = req.body || {};
    if (!soil) {
      return res.status(400).send("soil is required");
    }

    const lang = language === "ar" ? "ar" : "ar";
    const ctx = recommendationContext || {};
    const plantName = ctx.plantName || "";
    const stage = ctx.stage || "";
    const statusSummary = ctx.statusSummary || {};

    const prompt = `
أنت مساعد "نَسغ" الذكي، خبير في تفسير قراءات التربة للمزارع العُماني.

بيانات التربة (JSON):
${JSON.stringify(soil, null, 2)}

ملخص حالة العناصر مقابل المدى المثالي (من الجدول):
${JSON.stringify(statusSummary, null, 2)}

معلومات إضافية:
- نوع النبات (إن وجد): ${plantName || "غير محدد"}
- مرحلة النمو (إن وجدت): ${stage || "غير محددة"}

المطلوب:
- اكتب توصية كاملة ومترابطة بالمقطع العربي (${lang}) تشرح للمزارع:
  1) ما هي حالة التربة بشكل عام (جيدة، متوسطة، ضعيفة).
  2) لكل عنصر مهم (رطوبة، EC، pH، N، P، K، SHS) اذكر هل هو "نقص" أو "مناسب" أو "زيادة" بناءً على statusSummary، ولا تخالف الجدول.
  3) اعطِ خطوات عملية بسيطة:
     - تعديل الري (زيادة/تقليل، مثال عدد مرات أو مدة تقريبية).
     - نوعية التسميد (عضوي/كيميائي)، مع أمثلة عامة (بدون أسماء تجارية).
     - أي ملاحظات عن الملوحة أو pH إن كانت خارج المدى.
- استخدم أسلوب ودود، جُمل قصيرة وواضحة، وابتعد عن الحشو.
- لا تعِد كتابة JSON ولا أرقام كثيرة، فقط اذكر الأرقام عند الضرورة (مثلاً: "pH حوالي 5" أو "EC قريب من 1800").
- ركّز أن كلامك مبني على حالة الجدول الحالية، لا تغيّر حالة عنصر من "نقص" إلى "زيادة" مثلاً.
`;

    const reply = await callGeminiText(prompt);
    return res.send(reply || "تعذر توليد التوصية حاليًا، جرّب مرة ثانية بعد قليل.");
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send("صار خطأ أثناء توليد التوصية، حاول مرة أخرى لاحقًا.");
  }
});

// ================== /api/nasgh-chat (شات مع Gemini) ==================

app.post("/api/nasgh-chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).send("GEMINI_API_KEY is not set");
    }

    const { message, history, style, soil, lastAdvice } = req.body || {};

    if (!message) {
      return res.status(400).send("message is required");
    }

    const historyText = Array.isArray(history)
      ? history
          .map((turn, idx) => {
            const speaker = turn.role === "user" ? "المزارع" : "مساعد نَسغ";
            return `${speaker} (${idx + 1}): ${turn.content}`;
          })
          .join("\n")
      : "";

    const soilText = soil ? JSON.stringify(soil, null, 2) : "لا توجد بيانات تربة مرفقة.";
    const adviceText = lastAdvice || "";

    const systemPrompt = `
أنت مساعد ذكي اسمه "نَسغ" تابع لمشروع زراعي عُماني لمراقبة التربة والري.

أسلوب الرد:
- عربي فصيح بسيط مع لمسة خفيفة من العامية العُمانية.
- نبرة ودودة وتشجيعية وعملية.
- ركّز على التربة والري والتسميد وقراءات نسغ (رطوبة، حرارة، pH، EC، NPK، SHS).
- لا تذكر أنك نموذج من Google أو Gemini، فقط قل أنك "مساعد نَسغ".
- لو سأل نفس السؤال أكثر من مرة، غيّر الأسلوب والترتيب والأمثلة مع الحفاظ على صحة المعلومة.
- اجعل الإجابة قصيرة نسبيًا ومُنظَّمة عند الحاجة.

بيانات تربة من آخر قراءة (إن وجدت):
${soilText}

آخر توصية نصية تم عرضها للمستخدم (إن وجدت):
${adviceText}

تاريخ المحادثة السابقة (للاطلاع فقط):
${historyText}

رسالة المزارع الآن:
${message}
`;

    const reply = await callGeminiText(systemPrompt);

    // الفرونت يتوقع نص مباشر (res.text())
    return res.send(
      reply ||
        "ما قدرت أطلع رد من المساعد الحين، جرّب تعيد السؤال بعد شوي لو سمحت 🙏"
    );
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send("صار خطأ بسيط في الخادم، حاول مرة ثانية بعد شوي.");
  }
});

// ================== تشغيل السيرفر ==================

app.listen(PORT, () => {
  console.log("Nasgh backend listening on port", PORT);
});
