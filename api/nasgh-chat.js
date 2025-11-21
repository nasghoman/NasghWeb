// api/nasgh-chat.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: "GEMINI_API_KEY is not set in Vercel env" });
  }

  const { message, history } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const historyText = Array.isArray(history)
    ? history
        .map((turn, idx) => {
          const speaker =
            turn.role === "user" ? "المزارع" : "مساعد نَسغ";
          return `${speaker} (${idx + 1}): ${turn.content}`;
        })
        .join("\n")
    : "";

  const prompt = `
أنت مساعد ذكي اسمه "نَسغ" تابع لمشروع زراعي عُماني لمراقبة التربة والري.

أسلوب الرد:
- اللغة: عربي فصيح بسيط + لمسة خفيفة من العامية العُمانية (مثل: شوي، تمام، الوضع طيب)، بدون مبالغة.
- النبرة: ودودة، مشجِّعة، تحترم خبرة المزارع وتضيف عليها.
- ركّز على: قراءات التربة (رطوبة، حرارة، pH، EC، NPK، SHS)، الري، التسميد، وصحة النبات في بيئة عمان.
- لا تقل أبداً أنك نموذج من Google أو Gemini؛ عرّف نفسك فقط كمساعد نَسغ.
- لو نفس السؤال تكرر، غيّر ترتيب الأفكار وطريقة الشرح والأمثلة، لكن احتفظ بصحّة المعلومة.
- اجعل الرد منظم، واذا كان الموضوع فيه خطوات، حوّلها لنقاط واضحة.

تاريخ المحادثة سابقاً (للاطلاع فقط، لا تعيده حرفياً):
${historyText}

سؤال المزارع الآن:
${message}
`;

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      apiKey;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    };

    const gemRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!gemRes.ok) {
      const text = await gemRes.text();
      console.error("Gemini error:", text);
      return res.status(500).json({ error: "Gemini API error", details: text });
    }

    const data = await gemRes.json();
    const reply =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0].text;

    if (!reply) {
      return res.json({
        reply:
          "صار عندي تعذّر بسيط في الجواب، جرّب تعيد سؤالك لو سمحت أو غيّر صياغته شوي 🙏"
      });
    }

    return res.json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
