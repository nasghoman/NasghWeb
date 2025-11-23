// api/nasgh-ai.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  const body = req.body || {};
  const { soil, language, plantName, stage, statusSummary } = body;

  if (!soil) {
    return res.status(400).json({ error: "soil is required" });
  }

  const lang = language === "ar" ? "ar" : "ar";

  const summaryText = statusSummary
    ? Object.entries(statusSummary)
        .map(([key, v]) => {
          if (!v) return "";
          return `- ${v.label}: الحالة = ${v.status}${
            v.value != null ? ` (قراءة نسغ ≈ ${v.value}${v.unit || ""})` : ""
          }${
            v.min != null && v.max != null
              ? `، المدى المثالي ${v.min}–${v.max}${v.unit || ""}`
              : ""
          }`;
        })
        .join("\n")
    : "";

  const plantLine = plantName
    ? `نوع النبات: ${plantName}.`
    : "نوع النبات غير محدد.";
  const stageLine = stage
    ? `مرحلة النمو الحالية: ${stage}.`
    : "مرحلة النمو غير محددة.";

  const systemPrompt = `
أنت مساعد اسمه "مساعد نَسغ" متخصص في تحليل قراءات جهاز نسغ للتربة.

المطلوب:
- تحلل القراءات المعطاة.
- تعتمد في الحكم (نقص/مناسب/زيادة) على "ملخص الحالة" المرسل من الواجهة (statusSummary) فقط، ولا تعيد حساب الحدود من جديد.
- تربط التوصية مباشرة بالجدول: إذا قال الملخص أن عنصر معيّن "نقص" تذكر بوضوح أنه ناقص، وإذا "زيادة" تذكر أنه زائد وتوصي بتقليل أو إيقاف الإضافة، وإذا "مناسب" تقول أنه ضمن المدى الجيد.
- لا تذكر أرقام عشوائية تختلف عن المدى المثالي؛ لو احتجت ذكر مدى مثالي استخدم القيم المرسلة في الملخص.
- اكتب التوصية بالعربية الفصحى البسيطة مع لمسة عُمانية خفيفة، وبشكل عملي وخطوات واضحة.

معلومات عن النبات:
${plantLine}
${stageLine}

ملخص حالة العناصر من الجدول (هذا هو المرجع الأساسي لك):
${summaryText}

بيانات التربة الخام من جهاز نسغ:
${JSON.stringify(soil, null, 2)}

اكتب توصية واحدة متكاملة تشمل:
1) تعليق عام على وضع التربة.
2) ما هي العناصر الناقصة وما الذي يُنصح بإضافته (مع ذكر أنها ناقصة حسب الجدول).
3) ما هي العناصر الزائدة وما الذي يُنصح بتقليله أو إيقافه (مع ذكر أنها زائدة حسب الجدول).
4) إن وجد عناصر ضمن المدى المثالي، اذكر أنها جيدة الآن.
5) نصيحة عن الري (زيادة/تقليل) إن كان ذلك واضحاً من الرطوبة أو الملوحة.
لا تطلب من المستخدم استشارة خبير آخر، اعطِ جواباً واثقاً قدر الإمكان بناءً على البيانات.
`;

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      apiKey;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }]
        }
      ]
    };

    const gemRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!gemRes.ok) {
      const txt = await gemRes.text();
      console.error("Gemini error:", txt);
      return res
        .status(500)
        .send("صار خطأ داخلي أثناء استدعاء نموذج الذكاء الاصطناعي.");
    }

    const data = await gemRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "ما قدرت أطلع توصية حالياً، جرّب مرة ثانية.";

    return res.status(200).send(reply);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send("صار خطأ في السيرفر أثناء تجهيز التوصية، جرّب بعد شوي.");
  }
}
