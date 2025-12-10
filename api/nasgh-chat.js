// /api/nasgh-chat.js
// Next.js (Vercel Serverless Function) – DeepSeek backend لمساعد نَسغ

export default async function handler(req, res) {
  // CORS بسيط (ما يضر حتى لو نفس الدومين)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "DEEPSEEK_API_KEY is not set in environment variables." });
  }

  // ===== قراءة الـ body بأمان =====
  let body = {};
  try {
    if (typeof req.body === "string") {
      body = JSON.parse(req.body || "{}");
    } else {
      body = req.body || {};
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { message, history = [] } = body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required (string)" });
  }

  // ===== System Prompt لمساعد نَسغ =====
  const systemPrompt = `
أنت "مساعد نَسغ" الزراعي، تابع لمشروع نَسغ لمراقبة التربة والري في عُمان.

قواعد الرد:
- اللغة: عربي واضح وبسيط يناسب المزارع العُماني.
- ابدأ الرد دائمًا بالجملة: "حياك أخوي،" مرة واحدة في أول السطر.
- لا تستخدم JSON أبدًا، ولا تكتب كلمات مثل "reply" أو أقواس {} أو "\\n".
- استخدم جمل قصيرة، من 3 إلى 5 جمل، بدون تعداد برمجي مع نجوم أو أرقام.
- ركّز على:
  - حالة التربة (الرطوبة، الملوحة EC، درجة الحموضة pH، NPK، SHS) إن ذُكرت في السؤال.
  - نصائح عملية عن الري والتسميد وتحسين التربة بطرق كيميائية أو عضوية بسيطة.
- إذا كان السؤال بعيد عن الزراعة أو التربة أو الري أو التسميد أو قراءات جهاز نَسغ،
  اعتذر بجملة قصيرة وقل إن دورك فقط في المواضيع الزراعية.

اكتب النص النهائي مباشرة كما لو أنك تراسل مزارع على واتساب.
`;

  // ===== تحويل الـ history إلى messages بأسلوب Chat Completions =====
  const messages = [
    { role: "system", content: systemPrompt }
  ];

  if (Array.isArray(history)) {
    for (const turn of history) {
      if (!turn || !turn.content) continue;
      const role =
        turn.role === "assistant" || turn.role === "system"
          ? "assistant"
          : "user";
      messages.push({
        role,
        content: String(turn.content)
      });
    }
  }

  // آخر رسالة من المستخدم
  messages.push({
    role: "user",
    content: message
  });

  // ===== استدعاء DeepSeek =====
  const payload = {
    model: "deepseek-chat", // غيّرها لو استخدمت موديل آخر من DeepSeek
    messages,
    temperature: 0.6,
    max_tokens: 500
  };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("DeepSeek error:", data);
      const msg =
        (data && data.error && data.error.message) ||
        response.statusText ||
        "Unknown error from DeepSeek";
      return res.status(500).json({ error: msg });
    }

    const rawText = data.choices?.[0]?.message?.content || "";
    if (!rawText) {
      return res.status(500).json({ error: "Empty reply from DeepSeek" });
    }

    // تنظيف بسيط: تحويل \\n إلى أسطر حقيقية
    const cleanText = String(rawText).replace(/\\n/g, "\n").trim();

    return res.status(200).json({ reply: cleanText });
  } catch (err) {
    console.error("nasgh-chat server error:", err);
    return res.status(500).json({
      error: "Server error while calling DeepSeek",
      details: String(err.message || err)
    });
  }
}
