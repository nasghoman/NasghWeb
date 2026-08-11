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

    const userMessage = body.message || "";
    const image       = body.image || null; // الصورة بتنسيق Base64
    const soil        = body.soil || body.latestReading || null;
    const lastAdvice  = body.lastAdvice || body.advice || null;

    // التأكد من وجود نص أو صورة على الأقل
    if (!userMessage && !image) {
      return res.status(400).send("Missing user message or image");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== 1) فحص إذا السؤال/الطلب زراعي أو لا =====
    const checkText = userMessage || (image ? "قام المزارع بإرسال صورة للنبات أو التربة للفحص." : "");
    const guardPrompt = `
السؤال أو الطلب من المزارع:
"${checkText}"

قرّر فقط هل الطلب متعلق بالزراعة والتربة والنباتات والري والتسميد أم لا.
- اذا كان متعلقًا بالزراعة بأي شكل (أو يتضمن صورة نبات/تربة)، أجب بكلمة واحدة: "AGRI"
- اذا كان لا علاقة له بالزراعة، أجب بكلمة واحدة: "OTHER"
لا تكتب أي شيء آخر غير هذه الكلمة.
`;

    let classification = "AGRI";
    try {
      classification = await callGemini(guardPrompt, null, "gemini-3.1-flash-lite", apiKey);
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

- سؤال/طلب المزارع:
"${userMessage || "يرجى فحص الصورة المرفقة وتحديد مشكلة النبات والحل المناسب."}"

التعليمات لأسلوب الرد:
- خاطب المزارع بكلمة "أخوي" أو "أخي المزارع" في بداية الجواب.
- جاوب بصيغة واثقة، كأنك خبير نسغ معتمد تعتمد على قراءات الجهاز والفحص البصري للصورة.
- إذا كان هناك صورة مرفقة، افحص أوراق النبات أو التربة وحدد أعراض (نقص عناصر، إصابة حشرية، جفاف، فطر...) وأعطه العلاج فوراً.
- لا تطلب من المزارع استشارة مهندس زراعي أو خبير خارجي، ولا تذكر عبارات مثل: (استشر مختص، راجع مهندس زراعي، الأفضل تسأل خبير).
- اعطِ حلول عملية مباشرة: نوع السماد (مثلاً NPK 20-20-20، أو سماد عالي البوتاسيوم)، أو بدائل عضوية (سماد عضوي متحلل، كمبوست، سماد دجاج، رماد خشب، مخلفات نخيل... إلخ) حسب العنصر.
- خلك مختصر وواضح وسهل الفهم (من 3 إلى 6 جمل فقط).
- أربط إجابتك قدر الإمكان بقراءات التربة أو التوصية السابقة إذا كانت مناسبة للسؤال.
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
        const reply = await callGemini(mainPrompt, image, model, apiKey);
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

// 💡 دالة استدعاء Gemini لدعم النصوص والصور (Base64)
async function callGemini(promptText, imageBase64, model, apiKey) {
  const parts = [];

  // إذا وجدت صورة Base64 قم بتحليلها وإضافتها للـ parts
  if (imageBase64 && typeof imageBase64 === "string" && imageBase64.includes("data:image")) {
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      });
    }
  }

  // إضافة النص
  parts.push({ text: promptText });

  const payload = {
    contents: [{ parts: parts }],
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
