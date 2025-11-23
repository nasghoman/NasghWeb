// /api/nasgh-targets.js
// يحسب المدى المثالي لكل عنصر حسب نوع النبات + مرحلة النمو
// ويرجع JSON بالشكل: { targets: { temp:{min,max}, moisture:{...}, ... } }

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
    // قراءة الـ body يدوياً عشان نضمن الشغل على Vercel
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    let body = {};
    try {
      body = JSON.parse(bodyString || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { plantName, stage, soil } = body;

    if (!plantName || !stage || !soil) {
      return res.status(400).json({
        error: "Missing plantName, stage or soil in request body",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
    }

    // ===== prompt يطلب من جيميني يرجّع JSON فقط =====
    const promptText = `
أنت خبير زراعي يعمل مع جهاز "نسغ" لقياس التربة.

مهمتك:
1) بناء نطاق مثالي (min و max) لكل عنصر من العناصر التالية:
- temp   (درجة حرارة التربة °م)
- moisture (رطوبة التربة ٪)
- ec     (الملوحة µS/cm)
- ph     (درجة الحموضة)
- n      (النيتروجين N mg/kg)
- p      (الفوسفور P mg/kg)
- k      (البوتاسيوم K mg/kg)
- shs    (مؤشر صحة التربة SHS من 0 إلى 100 تقريباً)
- humic  (مؤشر الهيوميك أسيد، عادة 0–20 تقريباً)

المعطيات:
- نوع النبات: ${plantName}
- مرحلة النمو الحالية: ${stage}
- آخر قراءات من جهاز نسغ: ${JSON.stringify(soil, null, 2)}

التعليمات المهمة جداً:
- أرجع النتيجة بصيغة JSON فقط، بدون أي نص عربي أو شرح خارج JSON.
- لا تكتب وحدات داخل الأرقام، فقط أرقام.
- الشكل النهائي يجب أن يكون بالضبط:

{
  "targets": {
    "temp":    { "min": 0, "max": 0 },
    "moisture":{ "min": 0, "max": 0 },
    "ec":      { "min": 0, "max": 0 },
    "ph":      { "min": 0, "max": 0 },
    "n":       { "min": 0, "max": 0 },
    "p":       { "min": 0, "max": 0 },
    "k":       { "min": 0, "max": 0 },
    "shs":     { "min": 0, "max": 0 },
    "humic":   { "min": 0, "max": 0 }
  }
}

- استبدل الأصفار بقيم منطقية حسب خبرتك الزراعية ونوع النبات ومرحلة النمو.
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    const MODELS = [
      "gemini-2.0-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
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

        const text =
          json.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // نحاول نقتص JSON من النص (بعض الأحيان يضيف سطر قبله أو بعده)
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end === -1) {
          lastError = "No JSON object in Gemini response";
          continue;
        }

        const jsonSlice = text.slice(start, end + 1);

        let parsed;
        try {
          parsed = JSON.parse(jsonSlice);
        } catch (e) {
          lastError = "JSON parse error from Gemini: " + e.message;
          continue;
        }

        // تأكد أن فيه targets
        if (!parsed.targets) {
          lastError = "Missing 'targets' in Gemini response";
          continue;
        }

        return res.status(200).json(parsed);
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(500).json({
      error: "Gemini API error",
      details: lastError,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.toString(),
    });
  }
}
