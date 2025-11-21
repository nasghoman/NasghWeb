// api/nasgh-chat.js

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

    const message = body.message;
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return res.status(400).send("Missing message");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== تجهيز تاريخ المحادثة للنموذج =====
    const historyText = history
      .map((turn, idx) => {
        const who = turn.role === "assistant" ? "مساعد نَسغ" : "المزارع";
        return `${who} ${idx + 1}: ${turn.content}`;
      })
      .join("\n");

    // ===== prompt خاص بالشات (نَسغ + لهجة عمانية خفيفة) =====
    const promptText = `
أنت مساعد زراعي ذكي اسمه "نَسغ" تابع لمشروع عُماني لمراقبة التربة والري.

أسلوب الرد:
- اللغة: عربي فصيح بسيط مع لمسة خفيفة من العامية العُمانية (مثل: شوي، تمام، الوضع طيب)، بدون مبالغة.
- النبرة: ودودة، عملية، تشجع المزارع وتوضح له الخطوات بهدوء.
- ركّز على: التربة، الري، التسميد، قراءات أجهزة نسغ (رطوبة، درجة حرارة، pH، EC، NPK، SHS) وكل ما يتعلق بصحة النبات.
- لا تذكر أبداً أنك نموذج من Google أو Gemini؛ أنت فقط "مساعد نَسغ".
- لو تكرر نفس السؤال، غيّر صياغة الجواب وطريقة الشرح والأمثلة بحيث يبقى المحتوى صحيح لكن الأسلوب مختلف.

تاريخ المحادثة السابقة (لا تعِده حرفياً، فقط استعمله لفهم السياق):
${historyText || "لا يوجد تاريخ سابق."}

سؤال المزارع الآن:
${message}
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

    // ===== نفس الموديلات اللي تستخدمها في كود التوصيات =====
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
          // نخلي الـ frontend يستعمل data.reply مثل ما حطينا في الداشبورد
          return res.status(200).json({
            reply: text,
            modelUsed: model
          });
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
