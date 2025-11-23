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
    // قراءة البودي يدويًا (متوافق مع Vercel)
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

    const userMessage = body.message || "";
    const soil = body.soil || null;
    const lastAdvice = body.lastAdvice || "";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing GEMINI_API_KEY env var");
    }

    // ===== دالة اتصال عامة مع Gemini =====
    async function callGemini(promptText, model) {
      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
      };
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          json.error?.message || `Gemini error: ${response.status}`
        );
      }
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return text.trim();
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
      classification = await callGemini(guardPrompt, "gemini-2.0-flash");
    } catch (e) {
      classification = "AGRI"; // لو فشل التصنيف نكمل كأنه زراعي
    }

    if (classification !== "AGRI") {
      const safeReply =
        "حياك أخوي، هذا المساعد مخصص لأسئلة الزراعة والتربة والري والتسميد فقط 🌱. إذا عندك سؤال عن مزرعتك أو تربة نبات معيّن، اطرحه وبساعدك على قد ما أقدر.";
      return res.status(200).send(safeReply);
    }

    // ===== 2) برومبت الإجابة بأسلوب نسغ الواثق =====
    const soilText = soil ? JSON.stringify(soil, null, 2) : "لا توجد قراءات حديثة";
    const adviceText = lastAdvice || "لا توجد توصية مكتوبة حالياً.";

    const mainPrompt = `
أنت مساعد زراعي لمنتج اسمه "نسغ" في عمان.
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
- لا تطلب من المزارع استشارة مهندس زراعي أو خبير خارجي، ولا تذكر عبارات مثل:
  (استشر مختص، راجع مهندس زراعي، الأفضل تسأل خبير).
- اربط إجابتك قدر الإمكان بقراءات التربة: مثلاً إذا K منخفض → ركّز على البوتاسيوم، وهكذا.
- اعطِ حلول عملية مباشرة: نوع السماد (مثلاً NPK 20-20-20، أو سماد عالي البوتاسيوم)،
  أو بدائل عضوية (سماد عضوي متحلل، كمبوست، سماد دجاج، رماد خشب، مخلفات نخيل... إلخ) حسب العنصر.
- خلك مختصر وواضح وسهل الفهم (من 3 إلى 6 جمل فقط).
- استخدم جمل مثل:
  "من قراءات جهاز نسغ أنا أشوف أن..."،
  "أفضل شي تسويه الحين هو..."،
  "حاول تسوي كذا وكذا خلال الأيام الجاية..."
- لا تذكر أسماء موديلات الذكاء الاصطناعي ولا تشرح كيف تشتغل.
- لا تُرجع أي JSON أو تنسيق برمجي؛ أرجع نص عربي طبيعي فقط بدون أي حقول إضافية.

ابدأ الرد مباشرة بجملة عربية للمزارع بدون أي شرح تقني.
`;

    const MODELS = [
      "gemini-2.0-flash",
      "gemini-2.0-pro",
      "gemini-2.0-flash-lite",
    ];

    let lastError = null;
    for (const model of MODELS) {
      try {
        const reply = await callGemini(mainPrompt, model);
        return res.status(200).send(reply); // نرجّع النص فقط
      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    return res
      .status(500)
      .send("Gemini chat failed. Last error: " + JSON.stringify(lastError));
  } catch (err) {
    return res.status(500).send("Server error: " + err.toString());
  }
}
