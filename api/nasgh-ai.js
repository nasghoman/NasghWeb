export const config = {
  runtime: "nodejs",
};

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
      req.on("data", c => (data += c));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    let body = {};
    try {
      body = JSON.parse(bodyString || "{}");
    } catch {
      return res.status(400).send("Invalid JSON body");
    }

    const soil = body.soil;
    const language = body.language || "ar";

    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== prompt =====
    const promptText = `
هذه قراءات تربة من جهاز نَسغ:
${JSON.stringify(soil, null, 2)}

قدم توصية مختصرة باللغة ${language} تشمل:
- حالة الرطوبة والري المناسب
- الملوحة و pH
- تقييم NPK
- نصائح لتحسين خصوبة التربة
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    // ===== أقوى الموديلات الصحيحة اليوم =====
    const MODELS = [
      "gemini-2.0-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite"
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
          return res
            .status(200)
            .send(`Model used: ${model}\n\n${text}`);
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
