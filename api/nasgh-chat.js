// api/nasgh-chat.js
import omanRAGData from "./Oman_RAG.js";

// ==========================================
// 🧠 Chat RAG Retrieval Engine
// ==========================================
function retrieveRelevantChunksForChat(userMessage, soil) {
  const msg = (userMessage || "").toLowerCase();
  const matchedTags = new Set();

  // قاموس الكلمات المفتاحية ومقابلة الوسوم المعرفية
  const keywordMap = {
    "ملوحة": ["ec", "salinity", "gypsum"],
    "أملاح": ["ec", "salinity", "gypsum"],
    "حموضة": ["ph", "alkaline", "caco3"],
    "قلوية": ["ph", "alkaline", "caco3"],
    "سماد": ["npk", "fertilizer", "compost", "biochar"],
    "تسميد": ["npk", "fertilizer", "compost", "biochar"],
    "نيتروجين": ["nitrogen", "npk"],
    "فوسفور": ["phosphorus", "npk"],
    "بوتاسيوم": ["potassium", "npk"],
    "زنك": ["zinc", "caco3"],
    "كالسيوم": ["calcium", "caco3"],
    "أفيولايت": ["ophiolite", "heavy_metals", "geology"],
    "معادن": ["heavy_metals", "nickel", "chromium"],
    "نيكل": ["nickel", "heavy_metals"],
    "كروم": ["chromium", "heavy_metals"],
    "ساحل": ["coastal", "batinah", "muscat", "sharqiyah"],
    "الباطنة": ["batinah", "coastal"],
    "مسقط": ["muscat", "coastal"],
    "الشرقية": ["sharqiyah", "coastal"],
    "الجبل": ["mountainous", "rocky"],
    "صلالة": ["salalah", "dhofar"],
    "ظفار": ["dhofar", "salalah"],
    "صحراء": ["desert", "arid"],
    "نبات": ["flora", "forage"],
    "رعي": ["forage", "pasture"],
    "غاف": ["forage", "pasture"],
    "سلم": ["forage", "pasture"],
    "سام": ["toxic"],
    "أشخر": ["toxic"],
    "حرمل": ["toxic"],
    "حنظل": ["toxic"],
    "لبان": ["medicinal"],
    "صبر": ["medicinal"]
  };

  // 1. استخراج الوسوم من رسالة المزارع
  for (const [key, tags] of Object.entries(keywordMap)) {
    if (msg.includes(key)) {
      tags.forEach(t => matchedTags.add(t));
    }
  }

  // 2. تحليل بيانات الحساس الحية ودعم الوسوم
  if (soil) {
    if (soil.ph > 7.3) matchedTags.add("ph");
    if (soil.ec > 1500) matchedTags.add("ec");
    if (soil.n < 100 || soil.p < 50 || soil.k < 150) matchedTags.add("npk");
  }

  // 3. تقييم كل Chunk في قاعدة بيانات Oman RAG (Scoring Algorithm)
  const scored = omanRAGData.knowledge_base.map(chunk => {
    let score = 0;
    
    // مطابقة الوسوم
    if (chunk.tags) {
      chunk.tags.forEach(tag => {
        if (matchedTags.has(tag)) score += 3;
      });
    }

    // مطابقة النص في العنوان أو المحتوى
    const words = msg.split(/\s+/).filter(w => w.length > 3);
    words.forEach(w => {
      if (chunk.title && chunk.title.includes(w)) score += 2;
      if (chunk.content && chunk.content.includes(w)) score += 1;
    });

    return { ...chunk, score };
  });

  // 4. ترتيب تنازلي وترشيح أفضل قطعتين معرفيتين
  scored.sort((a, b) => b.score - a.score);
  const topChunks = scored.slice(0, 2);

  // إرجاع الأفضل أو إرجاع افتراضي لقواعد الخصوبة والقلوية العمانية
  return (topChunks[0] && topChunks[0].score > 0) 
    ? topChunks 
    : [omanRAGData.knowledge_base[2], omanRAGData.knowledge_base[3]];
}

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Only POST allowed");

  try {
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (c) => (data += c));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const body = JSON.parse(bodyString || "{}");
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

    // 🔍 1. استرجاع البيانات المعرفية المتطابقة (Chat RAG Pipeline)
    const retrievedChunks = retrieveRelevantChunksForChat(userMessage, soil);
    
    const ragContextText = retrievedChunks.map(c => 
      `[Chunk ID: ${c.chunk_id} | المصدر: ${c.metadata.source}]\n${c.content}`
    ).join("\n\n");

    const chunkIdsString = retrievedChunks.map(c => `[${c.chunk_id}]`).join(" ");

    // ===== 2. صياغة البرومبت المدعوم بالـ RAG =====
    const soilText = soil ? JSON.stringify(soil, null, 2) : "لا توجد قراءات حديثة";
    const adviceText = lastAdvice || "لا توجد توصية مكتوبة حالياً.";

    const mainPrompt = `
أنت المساعد الذكي لمشروع "نَسغ". تُجيب المزارع العُماني بناءً على قراءات الحساس والمستندات الرسمية للتربة والنباتات في سلطنة عُمان.
اللغة المطلوبة: عربية بسيطة بأسلوب محترم وعملي مع استخدام كلمة "أخوي".

بيانات الحساس المتاحة:
${soilText}

آخر توصية من النظام:
${adviceText}

=== السياق المسترجع من قاعدة بيانات RAG العُمانية (Oman RAG Retrieved Context) ===
${ragContextText}

سؤال المزارع:
"${userMessage}"

تعليمات الرد والإخراج:
1. ابدأ بـ "حياك أخوي".
2. أجِب بشكل مباشر ومختصر (من 3 إلى 5 جمل)، واستند في إجابتك إلى المعلومات المسترجعة أعلاه (مثل طبيعة التربة القلوية، أو الملوحة، أو استخدام مخلبات EDDHA والجبس والكمبوست).
3. اختم الرد دائماً بسطر يوضح المرجع الاسترجاعي للـ RAG بالشكل التالي نصاً:
   "🔍 مرجع الاسترجاع المعرفي (Oman_RAG): ${chunkIdsString}"
4. لا تذكر أي تفاصيل تقنية عن الكود أو أنك نموذج لغوي.
`;

    const MODELS = [
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro",
    ];

    for (const model of MODELS) {
      try {
        const reply = await callGemini(mainPrompt, model, apiKey);
        if (reply) {
          return res.status(200).send(reply.trim());
        }
      } catch (err) {
        continue;
      }
    }

    return res.status(500).send("Gemini RAG Chat failed on all models.");
  } catch (err) {
    return res.status(500).send("Server error: " + err.toString());
  }
}

// دالة استدعاء Gemini
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
