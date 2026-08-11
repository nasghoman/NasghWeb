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
    const weather       = body.weather || null;

    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    // ===== 1. البحث أولاً في Firebase Realtime Database =====
    const FIREBASE_DB_URL = process.env.FIREBASE_DATABASE_URL;
    
    console.log("🔍 [Backend Log] جاري البحث في Firebase...");

    if (FIREBASE_DB_URL) {
      try {
        const fbResponse = await fetch(`${FIREBASE_DB_URL}/soil_history.json`);
        if (fbResponse.ok) {
          const historyData = await fbResponse.json();
          if (historyData) {
            const records = Object.values(historyData);
            const matchedRecord = records.find((rec) => {
              if (!rec.soil) return false;
              const isPlantMatch = !plantName || rec.plantName === plantName;
              const isStageMatch = !stage || rec.stage === stage;
              
              const ecDiff = Math.abs((rec.soil.ec || 0) - (soil.ec || 0));
              const phDiff = Math.abs((rec.soil.ph || 0) - (soil.ph || 0));
              const moistDiff = Math.abs((rec.soil.moisture || 0) - (soil.moisture || 0));

              return isPlantMatch && isStageMatch && ecDiff < 50 && phDiff < 0.2 && moistDiff < 5;
            });

            if (matchedRecord && matchedRecord.advice) {
              console.log("✅ [Backend Log] تم العثور على إجابة في الفايربيس وتخطي المودل.");
              
              const htmlResponse = `<tr><td>ملاحظة مسجلة</td><td>${matchedRecord.advice}</td><td>متابعة دورية</td></tr>`;
              return res.status(200).send(htmlResponse);
            } else {
              console.log("⚠️ [Backend Log] لم يوجد سجل مطابق، سيتم استخدام الذكاء الاصطناعي.");
            }
          }
        }
      } catch (fbErr) {
        console.error("❌ [Backend Log Error]:", fbErr.message);
      }
    }

    // ===== 2. في حال عدم وجود إجابة في الفايربيس، الانتقال للذكاء الاصطناعي =====
    console.log("🤖 [Backend Log] جاري التوليد من نموذج Gemini...");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    const comparison =
      statusSummary
        ? buildComparisonFromSummary(statusSummary)
        : buildComparison(soil, targets);

    const weatherSection = (weather && typeof weather.airTemp !== "undefined") ? `
بيانات حالة الطقس:
- حرارة الجو: ${weather.airTemp}°م
- رطوبة الهواء: ${weather.airHumidity}%
` : "";

    const promptText = `
قراءات التربة من جهاز نَسغ:
${JSON.stringify(soil, null, 2)}

${plantName ? `نوع النبات: ${plantName}\n` : ""}
${stage ? `مرحلة النمو: ${stage}\n` : ""}
${weatherSection}

تحليل القراءات بالنسبة للمدى المثالي:
${comparison}

المطلوب:
اكتب توصية زراعية مختصرة جداً ومباشرة باللغة ${language} موجهة لمزارع عُماني، في شكل أسطر جدول HTML فقط <tr><td>...</td></tr> تتكون من 3 أعمدة لكل مشكلة:
1. المشكلة الحالية (كلمتين إلى 3 كلمات فقط، مثل: نقص نيتروجين، جفاف تربة...).
2. الحل المقترح (جملة قصيرة ومختصرة جداً تبدأ بكلمة "أخوي" وبدون أي إسهاب أو شرح مطول، المفيد فقط).
3. الكمية المناسبة (مختصرة جداً بوحدات عملية مثل: 15 جم/م²، لتر/م²، ري 20 دقيقة...).

⚠️ شروط هامة للتنسيق والشكل:
- اختصر الجمل إلى أقصى حد ممكن لكي لا تتشوه الداشبورد ولا تنكمش النصوص عمودياً.
- اكتب مباشرة أسطر <tr><td>...</td></tr> بدون <table> وبدون أي مقدمات أو علامات markdown مثل \`\`\`html.
- ممنوع الاستفاضة أو ذكر التفاصيل النظرية الكثيرة.
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    const MODELS = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-2.0-flash"
    ];

    const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
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

        let text = json.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
          text = text.trim();
          // تنظيف أي وسوم markdown إن وجدت
          text = text.replace(/```html/gi, "").replace(/```/g, "").trim();
          console.log(`✅ [Backend Log] تم التوليد بنجاح عبر نموذج: ${model}`);
          return res.status(200).send(text);
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
  if (!targets) return "استخدم القراءات فقط.";

  const params = [
    { key: "temp", label: "درجة الحرارة", field: "temp", unit: "°م" },
    { key: "moisture", label: "رطوبة التربة", field: "moisture", unit: "%" },
    { key: "ec", label: "الملوحة EC", field: "ec", unit: "µS/cm" },
    { key: "ph", label: "درجة الحموضة pH", field: "ph", unit: "" },
    { key: "n", label: "النيتروجين (N)", field: "n", unit: "mg/kg" },
    { key: "p", label: "الفوسفور (P)", field: "p", unit: "mg/kg" },
    { key: "k", label: "البوتاسيوم (K)", field: "k", unit: "mg/kg" }
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
      `- ${p.label}: القراءة ${vNum} ${p.unit}، المثالي (${min}-${max}) → ${status}.`
    );
  }

  return lines.join("\n") || "استخدم القراءات فقط.";
}

function buildComparisonFromSummary(statusSummary) {
  if (!statusSummary || typeof statusSummary !== "object") {
    return "استخدم القراءات فقط.";
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
      `- ${label}: القراءة ${value} ${unit}، المثالي (${min}-${max}) → ${status}.`
    );
  }

  return lines.join("\n") || "استخدم القراءات فقط.";
}
