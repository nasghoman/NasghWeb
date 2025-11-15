module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Only POST allowed");
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).send("Missing GEMINI_API_KEY in environment.");
    return;
  }

  try {
    const body = req.body || {};
    const soil = body.soil || {};

    const {
      id = "NASGH-1",
      temp,
      moisture,
      ec,
      ph,
      n,
      p,
      k,
      shs,
      humic,
    } = soil;

    const readingSummary = `
جهاز: ${id}
درجة الحرارة: ${temp} °م
رطوبة التربة: ${moisture} %
الملوحة (EC): ${ec} µS/cm
درجة الحموضة (pH): ${ph}
النيتروجين (N): ${n} mg/kg
الفوسفور (P): ${p} mg/kg
البوتاسيوم (K): ${k} mg/kg
مؤشر صحة التربة (SHS): ${shs}
مؤشر الهيوميك: ${humic}
`.trim();

    const prompt = `
أنت مساعد زراعي ذكي تابع لمشروع "نَسغ" العماني.
مهمتك تحليل حالة التربة بناءً على قراءات مجس التربة، ثم إعطاء توصيات بسيطة وواضحة للمزارع باللغة العربية.

البيانات الحالية:
${readingSummary}

تعليمات مهمة لأسلوب الإجابة:
- اكتب بالعربية الفصحى المبسطة.
- قسّم الإجابة إلى أجزاء:
  1) ملخص حالة التربة
  2) توصيات الري
  3) توصيات التسميد (NPK)
  4) ملاحظات عن الملوحة والحموضة والمادة العضوية/الهيوميك.
- إذا كانت الرطوبة منخفضة جدًا → انصح بالري.
- إذا كانت عالية جدًا → حذّر من كثرة الري.
- إذا كانت EC مرتفعة (مثلاً > 2000 µS/cm) → حذّر من ملوحة التربة.
- إذا كان pH بعيدًا عن 6–7 → وضّح هل التربة حامضية أو قلوية.
- استخدم قيم N وP وK لتقدير هل التسميد الآزوتي/الفوسفاتي/البوتاسي منخفض أو مقبول بشكل تقريبي.
- استخدم مؤشر صحة التربة (SHS) والهيوميك كمؤشر على جودة المادة العضوية؛ لو منخفضة اقترح إضافة مواد عضوية أو هيوميك أسيد.

أرجِع نصًا عربيًا فقط منظمًا بالنقاط والعناوين القصيرة، بدون JSON وبدون تنسيق ماركداون.
`.trim();

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      res.status(500).send("Gemini API error");
      return;
    }

    const data = await geminiRes.json();

    const text =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.map(p => p.text || "").join("\n");

    res
      .status(200)
      .send(text || "لم أستطع توليد استجابة مناسبة من النموذج.");
  } catch (err) {
    console.error("Nasgh AI error:", err);
    res.status(500).send("حدث خطأ في معالجة طلب الذكاء الاصطناعي.");
  }
};
