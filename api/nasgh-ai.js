// السماح لـ CORS
export const config = {
  runtime: "nodejs18.x",
};

export default async function handler(req, res) {
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
    const body = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Gemini key missing!");
      return res.status(500).send("API key not found");
    }

    // تجهيز النص للذكاء الاصطناعي
    const text = `
      تحليل قراءات تربة نَسغ:
      الحرارة: ${body.soil.temp}
      الرطوبة: ${body.soil.moisture}
      EC: ${body.soil.ec}
      pH: ${body.soil.ph}
      نيتروجين: ${body.soil.n}
      فوسفور: ${body.soil.p}
      بوتاسيوم: ${body.soil.k}
      صحة التربة: ${body.soil.shs}
      هيوميك أسيد: ${body.soil.humic}

      اكتب توصية واضحة لري وتسميد المزرعة باللغة العربية.
    `;

    // إرسال الطلب لـ Gemini
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
        }),
      }
    );

    const data = await response.json();

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.error("Bad AI response:", data);
      return res.status(500).send("AI error");
    }

    const aiReply = data.candidates[0].content.parts[0].text;

    return res.status(200).send(aiReply);
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).send("Internal error: " + err.message);
  }
}
