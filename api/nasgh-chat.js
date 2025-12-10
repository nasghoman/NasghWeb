// api/nasgh-chat.js

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");

  try {
    // قراءة البودي يدويًا
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
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { message, history } = body || {};
    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Field 'message' (string) is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("nasgh-chat: GEMINI_API_KEY missing");
      return res
        .status(500)
        .json({ error: "Server config error: GEMINI_API_KEY not set" });
    }

    const historyText = Array.isArray(history)
      ? history
          .map((turn, i) => {
            const who = turn.role === "assistant" ? "مساعد نَسغ" : "المزارع";
            return `${who} (${i + 1}): ${turn.content}`;
          })
          .join("\n")
      : "";

    const systemPrompt = `
أنت مساعد ذكي اسمه "نَسغ" تابع لمشروع زراعي عُماني لمراقبة التربة والري.

قواعد الرد:
- عربي فصيح بسيط مع لمسة خفيفة عمانية.
- لا تذكر أنك نموذج من Google أو Gemini، فقط "مساعد نَسغ".
- ركز على التربة، الري، التسميد، وقراءات نسغ.
- اجعل الإجابات قصيرة وواضحة، وغيّر الأسلوب لو تكرر السؤال.

تاريخ المحادثة:
${historyText}

رسالة المزارع الآن:
${message}
`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
    };

    // نستخدم موديلات 1.5 مع v1beta
    const MODELS = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
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
          console.error("nasgh-chat: Gemini error for model", model, json);

          // لو المشكلة كوتا، نطلع بسرعة برسالة واضحة للمستخدم
          if (json.error?.status === "RESOURCE_EXHAUSTED") {
            return res.status(503).json({
              error: "quota",
              reply:
                "حياك أخوي، خدمة نَسغ AI متوقفة مؤقتًا بسبب حد الاستخدام في المزود الخارجي. تقدر تستخدم لوحة القراءات والدشبورد عادي، وبنرجع نفعل الذكاء الاصطناعي قريبًا إن شاء الله 🌿",
            });
          }

          lastError = json.error || response.statusText;
          continue;
        }

        const text =
          json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return res.status(200).json({ reply: text });
        } else {
          lastError = "Empty reply from model " + model;
        }
      } catch (err) {
        console.error("nasgh-chat: fetch error for model", model, err);
        lastError = err.message || String(err);
      }
    }

    return res.status(500).json({
      error: "Gemini API failed",
      details: lastError || "Unknown error",
    });
  } catch (err) {
    console.error("nasgh-chat: unexpected server error:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
}
