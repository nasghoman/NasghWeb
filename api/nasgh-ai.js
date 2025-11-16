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
    // ===== قراءة الـ body بطريقة NodeJS (بدون req.json) =====
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", err => reject(err));
    });

    let body;
    try {
      body = JSON.parse(bodyString || "{}");
    } catch (e) {
      return res.status(400).send("Invalid JSON body");
    }

    const soil = body.soil;
    const language = body.language || "ar";

    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    // ===== مفتاح Gemini من الـ Environment =====
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== إعداد الـ prompt =====
    const promptText = `
هذه قراءات تربة من جهاز نَسغ:
${JSON.stringify(soil, null, 2)}

حلّل القراءات وقدّم توصية عملية ومختصرة باللغة ${language} تشمل:
- حالة الرطوبة والري المقترح
- ملاحظة عن الملوحة و pH
- تقييم تقريبي لتوازن NPK
- اقتراحات عامة لتحسين صحة التربة (بدون أدوية بشرية أو أشياء خطرة).
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    // ===== قائمة الموديلات التي نجربها بالترتيب =====
    const MODELS = [
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
    ];

    const baseUrl =
      "https://generativelanguage.googleapis.com/v1beta/models";

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
          continue; // جرّب الموديل اللي بعده
        }

        const text =
          json.candidates?.[0]?.content?.parts?.[0]?.text || null;

        if (text) {
          // نجاح ✅
          return res.status(200).send(
            `Model used: ${model}\n\n` + text
          );
        } else {
          lastError = "Empty response from " + model;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    // لو ولا موديل اشتغل
    return res
      .status(500)
      .send(
        "Gemini API failed on all models. Last error: " +
          JSON.stringify(lastError)
      );
  } catch (error) {
    return res.status(500).send("Server error: " + error.toString());
  }
}
