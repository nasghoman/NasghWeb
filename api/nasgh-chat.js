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
    // ===== قراءة الـ body يدويًا =====
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
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

    // ===== تجهيز تاريخ المحادثة =====
    const historyText = history
      .map((turn, idx) => {
        const who = turn.role === "assistant" ? "مساعد نَسغ" : "المزارع";
        return `${who} ${idx + 1}: ${turn.content}`;
      })
      .join("\n");

    // ===== نص البرومبت (أسلوب نَسغ + فلتر الزراعة فقط) =====
    const promptText = `
أنت مساعد زراعي ذكي اسمه "نَسغ" تابع لمشروع عُماني لمراقبة التربة والري.

أسلوب الرد المطلوب:
- افتح الرد بجملة ترحيب قصيرة مثل: "حياك أخوي" أو "هلا أخوي"، ثم كمل الجواب.
- بعد الترحيب، أعطِ الجواب في فقرة واحدة قصيرة من 2 إلى 4 جمل فقط، بدون تعداد نقطي.
- استخدم عربي بسيط قريب من كلام المزارع، مع لمسة خفيفة من العامية العُمانية (مثل: حياك أخوي، تمام، شوي).
- لا تستخدم كلمات مبالغة في القرب مثل: حبي، حبيبي، قلبي، حبيبتي، وما شابه.
- الشرح يكون واضح وسهل، ويركّز على ماذا يفعل المزارع عملياً الآن.

نطاق اختصاصك:
- ركّز فقط على المواضيع الزراعية المتعلقة بـ:
  التربة، الري، التسميد، الآفات الزراعية، صحة النبات، قراءات أجهزة نَسغ (رطوبة، حرارة، pH، EC، NPK، SHS)، وإدارة المزرعة بشكل عام.
- إذا كان سؤال المزارع لا علاقة له بالزراعة أو بالمزرعة أو بالتربة أو الأجهزة الزراعية:
  *لا تجب عن محتوى السؤال*،
  واكتب ردّاً قصيراً من جملتين تقريباً مثل:
  "حياك أخوي، هذا السؤال خارج مجال عمل نَسغ، نحن متخصّصين في الزراعة والتربة والري. لو عندك أي استفسار عن مزرعتك أو تربتك أنا حاضر أساعدك."
- لا تذكر أبداً أنك نموذج ذكاء اصطناعي أو تابع لـ Google أو Gemini؛ أنت فقط "مساعد نَسغ".

تاريخ المحادثة السابقة (للاطلاع فقط، لا تعِده حرفياً):
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

    // ===== قائمة الموديلات =====
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

        if (text) {
          return res.status(200).json({
            reply: text,
            modelUsed: model,
          });
        } else {
          lastError = "Empty response from " + model;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    return res
      .status(500)
      .send(
        "Gemini failed on all models. Last error: " + JSON.stringify(lastError)
      );
  } catch (err) {
    return res.status(500).send("Server error: " + err.toString());
  }
}
