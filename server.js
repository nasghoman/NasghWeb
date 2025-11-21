// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // لو تستخدم Node أقل من 18، ثبت node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ================== تخزين مؤقت للقراءات ==================
// ملاحظة: هذا مؤقت في RAM. بعدين تقدر تربطه بـ DB أو Firebase.
let soilReadings = [];

/**
 * مثال على شكل القراءة:
 * {
 *   id: "NASGH-1",
 *   t: 24.4,
 *   m: 40.2,
 *   ec: 1796,
 *   ph: 6.4,
 *   n: 12,
 *   p: 8,
 *   k: 20,
 *   shs: 75.3,
 *   hum: 39.6,
 *   stage: "مرحلة النمو الخضري",
 *   advice: "نصيحة AI...",
 *   timestamp: "2025-11-21T10:30:00Z"
 * }
 */

// لو كان عندك ESP32 يرسل آخر قراءة للباكند، تقدر تستقبلها هنا:
app.post("/api/soil-data", (req, res) => {
  const data = req.body;

  if (!data) {
    return res.status(400).json({ error: "No data" });
  }

  // أضف توقيت إذا ما موجود
  if (!data.timestamp) {
    data.timestamp = new Date().toISOString();
  }

  // تقدر تضيف stage/advice لاحقاً من AI أو من منطقك
  if (!data.stage) data.stage = "غير محددة";
  if (!data.advice) data.advice = "";

  // ندفعها في بداية الآراي (أحدث شيء أولاً)
  soilReadings.unshift(data);

  // نخلي فقط آخر ١٠٠ قراءة مثلاً
  soilReadings = soilReadings.slice(0, 100);

  return res.json({ ok: true });
});

// endpoint يرجّع آخر قراءة (اللي تستخدمه index.html)
app.get("/api/soil-data", (req, res) => {
  if (!soilReadings.length) {
    return res.json({});
  }
  return res.json(soilReadings[0]);
});

// ================== /api/soil-history (آخر ١٠ قراءات) ==================

app.get("/api/soil-history", (req, res) => {
  const limit = parseInt(req.query.limit || "10", 10);

  // soilReadings أصلاً مرتبة من الأحدث للأقدم
  const lastN = soilReadings.slice(0, limit);

  return res.json(lastN);
});

// ================== /api/nasgh-chat (شات مع Gemini) ==================
//
// يحتاج متغيّر بيئة في ملف .env باسم:
// GEMINI_API_KEY=YOUR_KEY_HERE
//
// والـ frontend يرسل body بالشكل:
// {
//   "message": "...",
//   "history": [{ "role": "user"|"assistant", "content": "..." }, ...],
//   "style": "nasgh-ar-omani"
// }

app.post("/api/nasgh-chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
  }

  const { message, history, style } = req.body || {};

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  // نبني تاريخ محادثة نصي عشان نطلب من جيميني يغيّر اسلوبه في كل مرة
  const historyText = Array.isArray(history)
    ? history
        .map((turn, idx) => {
          const speaker =
            turn.role === "user" ? "المزارع" : "مساعد نَسغ";
          return `${speaker} (${idx + 1}): ${turn.content}`;
        })
        .join("\n")
    : "";

  const systemPrompt = `
أنت مساعد ذكي اسمه "نَسغ" تابع لمشروع زراعي عُماني لمراقبة التربة والري.

قيود وأسلوب الرد:
- اللغة: عربي فصيح بسيط، مع لمسة خفيفة من العامية العُمانية (بدون مبالغة).
- النبرة: ودودة، تشجيعية، عملية، وتراعي المزارع العماني.
- ركّز على التربة، الري، التسميد، وقراءات نسغ (رطوبة، حرارة، pH، EC، NPK، SHS).
- لا تذكر أنك نموذج من Google أو Gemini، اكتفِ بأنك "مساعد نَسغ".
- لو سأل نفس السؤال أكثر من مرة، غيّر الأسلوب والترتيب والأمثلة بحيث تبقى المعلومة صحيحة لكن الصياغة مختلفة.
- اجعل الإجابة منظمة على شكل نقاط عند الحاجة، بدون إطالة زائدة.

تاريخ المحادثة السابقة (للاطلاع فقط، لا تعيده حرفياً):
${historyText}

الرسالة الحالية من المزارع:
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
          parts: [{ text: systemPrompt }]
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
          "ما قدرت أطلع رد من النموذج الحين، جرّب تعيد السؤال بعد شوي لو سمحت 🙏"
      });
    }

    return res.json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ================== تشغيل السيرفر ==================

app.listen(PORT, () => {
  console.log("Nasgh backend listening on port", PORT);
});
