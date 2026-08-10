// api/nasgh-ai.js

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Only POST allowed");
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
      return res.status(400).send("Invalid JSON body");
    }

    const soil          = body.soil;
    const language      = body.language || "ar";
    const plantName     = body.plantName || null;
    const stage         = body.stage || null;
    const targets       = body.targets || null;
    const statusSummary = body.statusSummary || null; 
    const weather       = body.weather || null; // 👈 استقبال بيانات الطقس

    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== مقارنة القراءات مع المدى المثالي =====
    const comparison =
      statusSummary
        ? buildComparisonFromSummary(statusSummary)
        : buildComparison(soil, targets);

    // ===== صياغة نص الطقس فقط في حال وجود بيانات حقيقية =====
    const weatherSection = (weather && typeof weather.airTemp !== "undefined") ? `
بيانات حالة الطقس الحية بالمزرعة:
- حرارة الجو: ${weather.airTemp}°م
- رطوبة الهواء: ${weather.airHumidity}%
- سرعة الرياح: ${weather.windSpeed} كم/س
- احتمال الأمطار: ${weather.rainProbability}%
` : "";

    // ===== prompt =====
    const promptText = `
هذه قراءات تربة من جهاز نَسغ (soilReadings):
${JSON.stringify(soil, null, 2)}

${plantName ? `نوع النبات: ${plantName}\n` : ""}
${stage ? `مرحلة النمو الحالية: ${stage}\n` : ""}
${weatherSection}

تحليل جاهز بين القراءات والحدود المثالية (لا تعيد حساب الحدود، استخدم هذه الحالات كما هي):
${comparison}

اكتب توصية زراعية مختصرة باللغة ${language} موجهة لمزارع عُماني، بالشروط التالية:
- ابدأ بـ "حياك أخوي" في أول سطر فقط.
- استخدم 3 إلى 5 جمل قصيرة وواضحة، بدون نقاط كثيرة.
- ركّز على العناصر التي حالتها "نقص" أو "زيادة" حسب التحليل أعلاه:
  * الرطوبة والري.
  * الملوحة (EC) و pH.
  * عناصر NPK والبوتاسيوم خصوصًا.
${weatherSection ? "- اربط حالة الطقس الحالية (الحرارة، الرياح، أو الأمطار) بنصائح الري والتسميد بأسلوب طبيعي.\n" : ""}- اقترح أسمدة كيميائية أو بدائل عضوية بسيطة (سماد عضوي متحلل، سماد حيواني متخمر، كومبوست، رماد خشب، إلخ) حسب حالة العناصر.
- لا تستخدم كلمات مثل "حبي" أو "عزيزي" أو "قلق عليك"، فقط أسلوب محترم وبسيط مع كلمة "أخوي".
- لا تذكر أن عليك استشارة مهندس زراعي أو جهة أخرى، اعطِ الإجابة بناءً على قراءات نسغ والجدول فقط.
- إذا كان الطلب لا يتعلق بالزراعة، اعتذر بجملة قصيرة وقل إن دورك فقط لشرح حالة التربة والري والتسميد.

اكتب النص جاهز للعرض للمزارع بدون أي JSON أو تنسيق برمجي.
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    const MODELS = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro",
    ];

    const baseUrl = "https://generativelanguage.googleapis.com/v1/models";
    let lastError = null;

    for (const model of MODELS) {
      try {
        const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await response.json();

        if (!response.ok) {
          lastError = json.error || response.statusText;
          continue;
        }

        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          return res.status(200).send(text.trim());
        } else {
          lastError = "Empty response " + model;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res
      .status(500)
      .send("Gemini failed on all models. Last error: " + JSON.stringify(lastError));
  } catch (err) {
    return res.status(500).send("Server error: " + err.toString());
  }
}

function buildComparison(soil, targets) {
  if (!targets) return "لا توجد حدود مثالية في الطلب، استخدم القراءات فقط.";

  const params = [
    { key: "temp", label: "درجة الحرارة", field: "temp", unit: "°م" },
    { key: "moisture", label: "رطوبة التربة", field: "moisture", unit: "%" },
    { key: "ec", label: "الملوحة EC", field: "ec", unit: "µS/cm" },
    { key: "ph", label: "درجة الحموضة pH", field: "ph", unit: "" },
    { key: "n", label: "النيتروجين (N)", field: "n", unit: "mg/kg" },
    { key: "p", label: "الفوسفور (P)", field: "p", unit: "mg/kg" },
    { key: "k", label: "البوتاسيوم (K)", field: "k", unit: "mg/kg" },
    { key: "shs", label: "مؤشر صحة التربة SHS", field: "shs", unit: "" },
    { key: "humic", label: "مؤشر الهيوميك أسيد", field: "humic", unit: "" },
  ];

  let lines = [];

  for (const p of params) {
    const t = targets[p.key];
    const value = soil[p.field];
    if (!t || typeof value === "undefined" || value === null) continue;

    const vNum = Number(value);
    const min = Number(t.min);
    const max = Number(t.max);

    if (isNaN(vNum) || isNaN(min) || isNaN(max) || max <= min) continue;

    let status = "مناسب";
    if (vNum < min) status = "نقص";
    else if (vNum > max) status = "زيادة";

    lines.push(
      `- ${p.label}: القراءة الحالية ${vNum} ${p.unit}، والمدى المثالي من ${min} إلى ${max} ${p.unit} → الحالة: ${status}.`
    );
  }

  if (!lines.length) {
    return "لم أستطع مطابقة القراءات مع الحدود المثالية، استخدم القراءات فقط.";
  }

  return lines.join("\n");
}

function buildComparisonFromSummary(statusSummary) {
  if (!statusSummary || typeof statusSummary !== "object") {
    return "لا يوجد statusSummary، استخدم القراءات فقط.";
  }

  const lines = [];

  for (const key of Object.keys(statusSummary)) {
    const info = statusSummary[key];
    if (!info) continue;

    const label  = info.label || key;
    const value  = typeof info.value === "number" ? info.value : Number(info.value);
    const unit   = info.unit || "";
    const min    = typeof info.min === "number" ? info.min : Number(info.min);
    const max    = typeof info.max === "number" ? info.max : Number(info.max);
    const status = info.status || "غير معروف";

    lines.push(
      `- ${label}: القراءة الحالية ${value} ${unit}، والمدى المثالي من ${min} إلى ${max} ${unit} → الحالة: ${status}.`
    );
  }

  if (!lines.length) {
    return "statusSummary موجود لكن فاضي، استخدم القراءات فقط.";
  }

  return lines.join("\n");
}
