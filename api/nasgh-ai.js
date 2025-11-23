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
      req.on("data", (c) => (data += c));
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
    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== PROMPT: جملة قصيرة + منتج عضوي بديل =====
    const promptText = `
أنت مساعد زراعي عربي تابع لنظام "نَسغ" لمراقبة التربة.

الأسلوب المطلوب بالضبط:
- اكتب جملة أو جملتين فقط، لا أكثر.
- ابدأ دائمًا الجملة الأولى بالعبارة: "من قراءات جهاز نَسغ أنا أشوف أن".
- بعدها مباشرة صف أهم شيء واحد أو اثنين في حالة التربة (مثل: الرطوبة منخفضة، الملوحة عالية، البوتاسيوم ناقص، pH حامضي...).
- إذا كان في نقص في أي عنصر (N أو P أو K أو غيرها)، اذكر:
  1) نوع السماد الكيميائي المقترح بشكل عام (مثل: سماد عالي البوتاسيوم، سماد NPK متوازن).
  2) ومعه مباشرة **منتج عضوي بديل** مناسب لنفس العنصر، بصيغة عامة بدون أسماء شركات، مثل:
     - كمبوست عضوي متحلل
     - سماد روث أبقار/أغنام متخمر
     - سماد دجاج بينسوي متخمر
     - مستخلص طحالب بحرية
     - سماد عضوي غني بالبوتاسيوم (من قشور، رماد نباتي، أو مخلفات نباتية)
- استخدم أسلوب مشابه لطول وبساطة هذا المثال:
  "من قراءات جهاز نَسغ أنا أشوف إن تربتك فيها البوتاسيوم منخفض واجد وضروري تستخدم سماد عالي البوتاسيوم أو منتج عضوي بديل للبوتاسيوم مثل سماد عضوي متحلل غني بالبوتاسيوم أو مستخلص طحالب بحرية."
- لا تستخدم أي نقاط أو نجوم أو فقرات طويلة أو عناوين أو ترقيم.
- استخدم عربي بسيط مع لمسة عُمانية خفيفة (كلمات مثل: واجد، شوي، مزرعتك)، لكن خلك محترم ورسمي.
- ركّز على ما يحتاج المزارع يفعله الآن (نوع السماد وطريقة عامة للاستخدام) بدون شرح علمي طويل.

هذه قراءات التربة من جهاز نَسغ (استخدم الأرقام فقط لتحليل الوضع، لا تعيد طباعتها):
${JSON.stringify(soil, null, 2)}

اكتب الرد الآن وفق القواعد السابقة كجملة أو جملتين فقط.
`;

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
    };

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
          // نرجّع النص فقط بدون أي مقدمة إضافية
          return res.status(200).send(text.trim());
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
