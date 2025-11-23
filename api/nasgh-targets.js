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
    // قراءة البودي يدويًا (متوافق مع Vercel)
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", c => (data += c));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    let body = {};
    try {
      body = JSON.parse(bodyString || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const plantName = body.plantName || "";
    const stage = body.stage || "";
    const soil = body.soil || null;

    if (!plantName || !stage || !soil) {
      return res
        .status(400)
        .json({ error: "Missing plantName, stage or soil readings" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY env var" });
    }

    const promptText = `
أنت خبير زراعي متعاون مع فريق "نسغ" في عمان.

لدينا بيانات تربة من عصا نسغ:
${JSON.stringify(soil, null, 2)}

نوع النبات: "${plantName}"
مرحلة النمو: "${stage}" (قيم محتملة: vegetative, flowering, fruit-setting, harvest)

نريد أن ترجع لنا فقط كائن JSON واحد بدون أي كلام إضافي، بالشكل التالي تماماً:

{
  "targets": {
    "temp":   { "min": 20,  "max": 28 },
    "moisture": { "min": 30,  "max": 45 },
    "ec":     { "min": 1200,"max": 2200 },
    "ph":     { "min": 5.8, "max": 7.0 },
    "n":      { "min": 80,  "max": 150 },
    "p":      { "min": 60,  "max": 120 },
    "k":      { "min": 120, "max": 220 },
    "shs":    { "min": 60,  "max": 90 },
    "humic":  { "min": 40,  "max": 70 }
  }
}

التعليمات المهمة:
- عدّل الأرقام لتكون منطقية حسب نوع المحصول ومرحلة النمو والقراءات الحالية.
- إذا لم تكن متأكد من عنصر معين، اجعل "min" و "max" مساوية لـ null لهذا العنصر.
- لا تضف أي حقول أخرى خارج "targets".
- لا تكتب أي نص أو شرح خارج JSON.
- لا تستخدم تعليقات أو علامات مثل ```json، فقط JSON خام.
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

        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          lastError = "Empty response from model " + model;
          continue;
        }

        // أحياناً جيميني يرجع JSON داخل ```json ... ```
        let cleaned = text.trim();
        const fenceMatch = cleaned.match(/```json([\s\S]*?)```/i);
        if (fenceMatch) {
          cleaned = fenceMatch[1].trim();
        }

        try {
          const parsed = JSON.parse(cleaned);
          if (!parsed.targets) {
            lastError = "No 'targets' field in response";
            continue;
          }
          return res.status(200).json(parsed);
        } catch (e) {
          lastError = "JSON parse error: " + e.message + " | raw: " + cleaned;
          continue;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res
      .status(500)
      .json({ error: "Gemini targets failed", details: lastError });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Server error", details: err.toString() });
  }
}
