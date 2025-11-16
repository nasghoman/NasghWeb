// api/nasgh-ai.js

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
    // جسم الطلب القادم من الواجهة
    const body = req.body || {};
    const soil = body.soil || {};
    const language = body.language || "ar";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // 🧠 قائمة الموديلات من الأقوى للأضعف (أو الأحدث للأقدم)
    const MODELS = [
      "gemini-1.5-pro-latest",
      "gemini-1.5-flash-latest",
      "gemini-pro",
      "gemini-1.0-pro"
    ];

    const prompt = `
أنت خبير زراعي ذكي ضمن مشروع "نَسغ".
حلل القياسات التالية للتربة، ثم أعطِ:
- تشخيص لحالة التربة بشكل مختصر.
- توصية ري واضحة (كم مرة أو كمية تقريبية).
- توصية تسميد (نوع السماد أو المادة + ملاحظة عن الجرعة بشكل عام).
- ملاحظة عامة عن صحة التربة.

الرد يكون باللغة: ${language === "ar" ? "العربية" : "Arabic"}،
وبأسلوب بسيط يستطيع المزارع العادي فهمه.

البيانات المقاسة:
${JSON.stringify(soil, null, 2)}
`;

    let lastError = null;
    let finalText = null;
    let usedModel = null;

    // 🔁 جرّب الموديلات واحد واحد إلى أن ينجح واحد
    for (const model of MODELS) {
      try {
        const apiUrl =
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        });

        const result = await response.json();

        if (result.error) {
          // 404 أو 400 أو غيرها → جرّب الموديل اللي بعده
          console.error(`Gemini error on model ${model}:`, result.error);
          lastError = result.error;
          continue;
        }

        const text =
          result.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!text) {
          lastError = { message: "Empty response from model " + model };
          continue;
        }

        usedModel = model;
        finalText =
          `الموديل المستخدم: ${model}\n\n` +
          text;
        break; // وقف بعد أول نجاح
      } catch (err) {
        console.error(`Request failed for model ${model}:`, err);
        lastError = { message: err.message };
        continue;
      }
    }

    if (!finalText) {
      return res
        .status(500)
        .send(
          "Gemini API failed on all models. Last error: " +
            (lastError?.message || "unknown")
        );
    }

    // ✅ رجع التوصية
    return res.status(200).send(finalText);
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).send("Server error: " + err.message);
  }
}
