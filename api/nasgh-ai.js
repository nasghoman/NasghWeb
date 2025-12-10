// api/nasgh-ai.js

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

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(500).send("Missing DEEPSEEK_API_KEY env var");
  }

  try {
    // قراءة البودي
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
    const language = body.language || "ar";
    const plantName = body.plantName || null;
    const stage = body.stage || null;
    const targets = body.targets || null;

    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    // نبني نفس comparison اللي كنا نستخدمه عشان يكون مطابق للجدول
    const comparison = buildComparison(soil, targets);

    const promptText = `
هذه قراءات تربة من جهاز نَسغ (soilReadings):
${JSON.stringify(soil, null, 2)}

${plantName ? `نوع النبات: ${plantName}\n` : ""}
${stage ? `مرحلة النمو الحالية: ${stage}\n` : ""}

${targets ? `وهذه الحدود المثالية لكل عنصر (idealTargets):\n${JSON.stringify(targets, null, 2)}\n` : ""}

تحليل جاهز بين القراءات والحدود المثالية (نفس الجدول في واجهة نَسغ – لا تعيد حساب الحدود، فقط استخدم هذه الحالات كما هي):
${comparison}

المطلوب منك:
- اكتب توصية زراعية مختصرة باللغة ${language} موجهة لمزارع عُماني.
- ابدأ بجملة ترحيب قصيرة بكلمة "حياك أخوي".
- استخدم من 3 إلى 5 جمل قصيرة وواضحة (ليست نقاط طويلة).
- ركّز على العناصر التي حالتها "نقص" أو "زيادة" حسب التحليل أعلاه، ولا تناقض حالة الجدول:
  * الرطوبة والري.
  * الملوحة (EC) و pH.
  * عناصر NPK والبوتاسيوم.
- اقترح أسمدة كيميائية أو بدائل عضوية بسيطة (سماد عضوي متحلل، سماد حيواني متخمر، كومبوست، رماد خشب، إلخ) بما يناسب حالة كل عنصر (نقص أو زيادة).
- لا تذكر DeepSeek أو نماذج لغة أو ذكاء اصطناعي، فقط تحدث كمساعد نَسغ.
- لا تطلب من المزارع استشارة جهة أخرى؛ اعطِ التوصية بناءً على القراءات والجدول فقط.
- إذا كانت كل العناصر ضمن المدى المثالي تقريبًا، ركّز على رسالة تطمين، مع نصيحة خفيفة عن الاستمرار على نفس نمط الري والتسميد.

اكتب النص جاهز للعرض للمزارع بدون أي JSON أو تنسيق برمجي.
`;

    const url = "https://api.deepseek.com/chat/completions";

    const payload = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "أنت مساعد نَسغ الزراعي." },
        { role: "user", content: promptText },
      ],
      temperature: 0.6,
    };

    const dsRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!dsRes.ok) {
      const text = await dsRes.text();
      console.error("DeepSeek nasgh-ai error:", text);
      return res
        .status(500)
        .send("DeepSeek API error: " + text.substring(0, 300));
    }

    const data = await dsRes.json();
    const text = data.choices?.[0]?.message?.content || "";

    if (!text) {
      return res
        .status(500)
        .send("DeepSeek returned empty response for nasgh-ai.");
    }

    return res.status(200).send(text.trim());
  } catch (err) {
    console.error("nasgh-ai server error:", err);
    return res.status(500).send("Server error: " + err.toString());
  }
}

/**
 * نفس منطق الجدول: حالة كل عنصر (نقص / مناسب / زيادة)
 */
function buildComparison(soil, targets) {
  if (!targets) return "لا توجد حدود مثالية في الطلب، استخدم القراءات فقط.";

  const params = [
    { key: "temp", label: "درجة الحرارة", field: "temp", unit: "°م" },
    { key: "moisture", label: "رطوبة التربة", field: "moisture", unit: "%" },
    { key: "ec", label: "الملوحة EC", field: "ec", unit: "µS/cm" },
    { key: "ph", label: "درجة الحموضة pH", field: "ph", unit: "" },
    { key: "n", label: "النيتروجين (N)", field: "n", unit: "mg/kg" },
    { key: "p", label: "الفوسفور (P)", field: "p", unit: "mg/kg" },
    { key: "k", label: "البوتاسيوم (K)", field: "k", unit: "mg/kg" },
    { key: "shs", label: "مؤشر صحة التربة SHS", field: "shs", unit: "" },
    { key: "humic", label: "مؤشر الهيوميك أسيد", field: "humic", unit: "" },
  ];

  let lines = [];

  for (const p of params) {
    const t = targets[p.key];
    const value = soil[p.field];
    if (!t || typeof value === "undefined" || value === null) continue;

    const vNum = Number(value);
    const min = Number(t.min);
    const max = Number(t.max);

    if (isNaN(vNum) || isNaN(min) || isNaN(max) || max <= min) continue;

    let status = "مناسب";
    if (vNum < min) status = "نقص";
    else if (vNum > max) status = "زيادة";

    lines.push(
      `- ${p.label}: القراءة الحالية ${vNum} ${p.unit}، والمدى المثالي من ${min} إلى ${max} ${p.unit} → الحالة: ${status}.`
    );
  }

  if (!lines.length) {
    return "لم أستطع مطابقة القراءات مع الحدود المثالية، استخدم القراءات فقط.";
  }

  return lines.join("\n");
}
