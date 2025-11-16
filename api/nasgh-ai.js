// /api/nasgh-ai.js
// Serverless Function عادية على Vercel مع CORS + Gemini

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // السماح فقط بـ POST
  if (req.method !== "POST") {
    return res.status(405).send("Only POST allowed");
  }

  try {
    const body = req.body || {};
    const soil = body.soil || {};

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY");
      return res.status(500).send("API key missing");
    }

    const summary = `
قراءات تربة من جهاز نَسغ:
الحرارة: ${soil.temp} °م
رطوبة التربة: ${soil.moisture} %
الملوحة (EC): ${soil.ec} µS/cm
درجة الحموضة (pH): ${soil.ph}
النيتروجين (N): ${soil.n} mg/kg
الفوسفور (P): ${soil.p} mg/kg
البوتاسيوم (K): ${soil.k} mg/kg
مؤشر صحة التربة (SHS): ${soil.shs}
مؤشر الهيوميك أسيد: ${soil.humic}
`.trim();

    const prompt = `
أنت مساعد زراعي ذكي تابع لمشروع "نَسغ".
حلّل هذه القراءات ثم أعطِ:
1) ملخص لحالة التربة
2) توصيات ري
3) توصيات تسميد NPK
4) ملاحظات عن الملوحة والحموضة والمادة العضوية/الهيوميك

اكتب بالعربية الفصحى المبسطة وبشكل نقاط واضحة.

البيانات:
${summary}
`.trim();

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      apiKey;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("Gemini error:", aiRes.status, txt);
      return res.status(500).send("Gemini API error: " + aiRes.status);
    }

    const data = await aiRes.json();

    const aiText =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n")
        .trim() || "لم أستطع توليد استجابة مناسبة من النموذج.";

    return res.status(200).send(aiText);
  } catch (err) {
    console.error("Nasgh AI server error:", err);
    return res.status(500).send("Internal error: " + err.message);
  }
};
