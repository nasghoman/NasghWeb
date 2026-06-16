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

    const userMessage = body.message;
    const soil        = body.soil;
    const lastAdvice  = body.lastAdvice;

    if (!userMessage) {
      return res.status(400).send("Missing user message");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== 1) فحص إذا السؤال زراعي أو لا =====
    const guardPrompt = `
السؤال من المزارع:
"${userMessage}"

قرّر فقط هل السؤال متعلق بالزراعة والتربة والنباتات والري والتسميد أم لا.
- اذا كان متعلقًا بالزراعة بأي شكل، أجب بكلمة واحدة: "AGRI"
- اذا كان لا علاقة له بالزراعة، أجب بكلمة واحدة: "OTHER"
لا تكتب أي شيء آخر غير هذه الكلمة.
`;

    let classification = "AGRI";
    try {
      // تم تمرير apiKey للدالة بعد نقلها بالأسفل
      classification = await callGemini(guardPrompt, "gemini-3.1-flash-lite", apiKey);
    } catch (e) {
      classification = "AGRI"; // لو فشل التصنيف نكمل كأنه زراعي
    }

    if (!classification.includes("AGRI")) {
      const safeReply =
        "حياك أخوي، هذا المساعد مخصص لأسئلة الزراعة والتربة والري والتسميد فقط 🌱. إذا عندك سؤال عن مزرعتك أو تربة نبات معيّن، اطرحه وبساعدك على قد ما أقدر.";
      return res.status(200).send(safeReply);
    }

    // ===== 2) برومبت الإجابة بأسلوب نسغ الواثق =====
    const soilText = soil ? JSON.stringify(soil, null, 2) : "لا توجد قراءات حديثة";
    const adviceText = lastAdvice || "لا توجد توصية مكتوبة حالياً.";

    const mainPrompt = `
أنت خبير زراعي ذكي يمثل نظام "نَسغ" الذكي لـمراقبة التربة والري.
اللغة المطلوبة: عربية بسيطة + لمسة خفيفة من العامية العمانية بدون مبالغة.

المعلومات المتاحة:
- آخر قراءات من جهاز نسغ إن وجدت (درجة الحرارة، رطوبة التربة، EC، pH، NPK، SHS ...):
${soilText}

- آخر توصية مكتوبة من نسغ إن وجدت:
${adviceText}

- سؤال المزارع:
"${userMessage}"

التعليمات لأسلوب الرد:
- خاطب المزارع بكلمة "أخوي" أو "أخي المزارع" في بداية الجواب.
- جاوب بصيغة واثقة، كأنك خبير نسغ معتمد تعتمد على قراءات الجهاز.
- لا تطلب من المزارع استشارة مهندس زراعي أو خبير خارجي، ولا تذكر عبارات مثل: (استشر مختص، راجع مهندس زراعي، الأفضل تسأل خبير).
- اعطِ حلول عملية مباشرة: نوع السماد (مثلاً NPK 20-20-20، أو سماد عالي البوتاسيوم)، أو بدائل عضوية (سماد عضوي متحلل، كمبوست، سماد دجاج، رماد خشب، مخلفات نخيل... إلخ) حسب العنصر.
- خلك مختصر وواضح وسهل الفهم (من 3 إلى 6 جمل فقط).
- أربط إجابتك قدر الإمكان بقراءات التربة أو التوصية السابقة إذا كانت مناسبة للسؤال.
- لو المزارع يسأل عن معنى مرحلة نمو معينة أو شرح توصية، اشرحها له بلغة بسيطة.
- استخدم جمل مثل:
  "من قراءات جهاز نسغ أنا أشوف أن..."،
  "أفضل شي تسويه الحين هو..."،
  "حاول تسوي كذا وكذا خلال الأيام الجاية..."
- لا تذكر أسماء موديلات الذكاء الاصطناعي ولا تشرح كيف تشتغل ولا تذكر إنك نموذج لغوي، ركّز أن الكلام صادر من "مساعد نسغ".
- لا تُرجع أي JSON أو تنسيق برمجي؛ أرجع نص عربي طبيعي فقط بدون أي حقول إضافية.

ابدأ الرد مباشرة بجملة عربية للمزارع بدون أي شرح تقني.
`;

    const MODELS = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro",
    ];

    let lastError = null;

    for (const model of MODELS) {
      try {
        const reply = await callGemini(mainPrompt, model, apiKey);
        return res.status(200).send(reply.trim());
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    return res
      .status(500)
      .send("Gemini failed on all models. Last error: " + JSON.stringify(lastError));
  } catch (err) {
    return res.status(500).send("Server error: " + err.toString());
  }
}

// 💡 تم نقل الدالة هنا (خارج الـ handler الرئيسي) لمنع انهيار البيئة السحابية
async function callGemini(promptText, model, apiKey) {
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
  };
  const baseUrl = "https://generativelanguage.googleapis.com/v1/models";
  const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message || response.statusText);
  }
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
