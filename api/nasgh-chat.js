// api/nasgh-chat.js

export default async function handler(req, res) {
  // CORS بسيط
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
    return res.status(500).json({ error: "Missing DEEPSEEK_API_KEY env var" });
  }

  try {
    // نقرأ البودي يدويًا (نفس ستايل ملفاتك السابقة)
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
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { message, history } = body || {};

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    // نبني نص المحادثة السابقة على شكل نص واحد
    const historyText = Array.isArray(history)
      ? history
          .map((turn, idx) => {
            const who = turn.role === "user" ? "المزارع" : "مساعد نَسغ";
            return `${who} (${idx + 1}): ${turn.content}`;
          })
          .join("\n")
      : "";

    const systemPrompt = `
أنت مساعد زراعي ذكي اسمه "مساعد نَسغ" تابع لمشروع نَسغ العُماني لمراقبة التربة والري.

أسلوبك:
- اللغة: عربي فصيح مبسط مع لمسة عُمانية خفيفة (بدون مبالغة).
- لا تذكر أنك نموذج ذكاء اصطناعي أو DeepSeek أو أي شركة، أنت فقط "مساعد نَسغ".
- ركّز على: التربة، الري، التسميد، قراءات جهاز نَسغ (رطوبة، حرارة، pH، EC، NPK، SHS).
- اجعل الإجابة قصيرة وواضحة، منسّقة على شكل فقرات أو نقاط بسيطة عند الحاجة.
- إذا كان السؤال خارج الزراعة، رد بجملة قصيرة: "دوري في نَسغ هو المساعدة في التربة والري والتسميد فقط يا أخوي 🌿".

تاريخ المحادثة السابقة (للاطلاع فقط):
${historyText}
`;

    // DeepSeek Chat API
    const url = "https://api.deepseek.com/chat/completions";

    const payload = {
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
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
      console.error("DeepSeek error:", text);
      return res
        .status(500)
        .json({ error: "DeepSeek API error", details: text });
    }

    const data = await dsRes.json();
    const reply = data.choices?.[0]?.message?.content || "";

    if (!reply) {
      return res.json({
        reply:
          "حياك أخوي، صار تعذّر بسيط في توليد الرد. جرّب تعيد سؤالك أو تغيّر صياغته شوي 🌿",
      });
    }

    return res.json({ reply: reply.trim() });
  } catch (err) {
    console.error("nasgh-chat server error:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message });
  }
}
