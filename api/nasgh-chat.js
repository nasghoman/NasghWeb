// api/nasgh-chat.js

export default async function handler(req, res) {
  // ===== CORS بسيط لو احتجته مستقبلاً من دومين آخر =====
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
    // ===== قراءة الـ body يدوياً (متوافق مع Vercel Node) =====
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", (err) => reject(err));
    });

    let body = {};
    try {
      body = JSON.parse(bodyString || "{}");
    } catch (e) {
      console.error("nasgh-chat: invalid JSON body:", e);
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
      console.error("nasgh-chat: GEMINI_API_KEY is missing");
      return res
        .status(500)
        .json({ error: "Server config error: GEMINI_API_KEY not set" });
    }

    // ===== بناء تاريخ المحادثة كنص =====
    const historyText = Array.isArray(history)
      ? history
          .map((turn, i) => {
            const who = turn.role === "assistant" ? "مساعد نَسغ" : "المزارع";
            return `${who} (${i + 1}): ${turn.content}`;
          })
          .join("\n")
      : "";

    // ===== System prompt للمساعد =====
    const systemPrompt = `
أنت مساعد ذكي اسمه "نَسغ" تابع لمشروع زراعي عُماني لمراقبة التربة والري.

قواعد الرد:
- اللغة: عربي فصيح بسيط مع لمسة خفيفة من اللهجة العُمانية.
- لا تذكر أنك نموذج ذكاء اصطناعي أو تابع لـ Google أو Gemini.
- عرّف نفسك دائماً بأنك "مساعد نَسغ".
- ركّز على: التربة، الري، التسميد، قراءات نَسغ (رطوبة، حرارة، pH، EC، NPK، SHS).
- اجعل الإجابات مختصرة وواضحة، ويفضّل تقسيمها لجمل قصيرة أو نقاط بدون مبالغة.
- إذا كرر المستخدم نفس السؤال، غيّر طريقة الشرح والأمثلة لكن حافظ على نفس المعلومة الأساسية.
- تجنّب العبارات المبالغ فيها (مثل حبيبي، قلبي، ...)، استخدم أسلوب محترم وبسيط.

تاريخ المحادثة السابقة (للسياق فقط):
${historyText}

رسالة المزارع الآن:
${message}
`;

    // payload لـ Gemini
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }]
        }
      ]
    };

    const MODELS = [
      "gemini-2.0-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite"
    ];

    const baseUrl =
      "https://generativelanguage.googleapis.com/v1/models";

    let lastError = null;

    for (const model of MODELS) {
      try {
        const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await response.json();

        if (!response.ok) {
          console.error("nasgh-chat: Gemini error for model", model, json);
          lastError = json.error || response.statusText;
          continue;
        }

        const text =
          json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (text) {
          // المهم: نرجّع JSON فيه reply
          return res.status(200).json({ reply: text });
        } else {
          console.error("nasgh-chat: empty reply for model", model, json);
          lastError = "Empty reply from Gemini (" + model + ")";
        }
      } catch (err) {
        console.error("nasgh-chat: fetch error for model", model, err);
        lastError = err.message || String(err);
      }
    }

    // لو وصلت هنا يعني كل الموديلات فشلت
    return res.status(500).json({
      error: "Gemini API failed",
      details: lastError || "Unknown error"
    });
  } catch (err) {
    console.error("nasgh-chat: unexpected server error:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
}
