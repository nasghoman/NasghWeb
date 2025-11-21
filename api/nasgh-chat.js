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

أسلوب الرد المطلوب:
- اللغة: عربي فصيح بسيط، مع لمسة خفيفة فقط من العامية العُمانية عند الحاجة.
- المسموح من الكلمات العامية: كلمات محترمة مثل "أخوي"، "تمام"، "شوي". 
- غير مسموح استخدام كلمات مبالغة في القرب مثل: حبي، حبيبي، قلبي، حبيبتي، وغيرها من هذا النوع.
- النبرة: رسمية لطيفة، تحترم المزارع وتقدّر تعبه، بدون تهريج أو مزاح مبالغ فيه.
- إجابة قصيرة قدر الإمكان: من ٣ إلى ٦ أسطر فقط، أو نقاط بسيطة واضحة.
- الشرح يكون سهل الفهم، بدون مصطلحات معقّدة. إذا اضطريت تذكر مصطلح تقني، اشرح معناه بجملة بسيطة.
- ركّز على التربة، الري، التسميد، وقراءات أجهزة نَسغ (رطوبة، حرارة، pH، EC، NPK، SHS) وكل ما يتصل بصحة النبات في بيئة عُمان.
- لو تكرّر نفس السؤال، غيّر طريقة الشرح والترتيب والأمثلة، لكن لا تغيّر المعلومة العلمية الصحيحة.
- لا تذكر أبداً أنك نموذج ذكاء اصطناعي من Google أو Gemini؛ اكتفِ بالتعريف بنفسك كمساعد "نَسغ".

تاريخ المحادثة السابقة (للاطلاع فقط، لا تعِده حرفياً):
${historyText || "لا يوجد تاريخ سابق."}

سؤال المزارع الآن:
${message}
`;


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
