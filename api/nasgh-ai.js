// api/nasgh-ai.js
import omanRAGData from "./Oman_RAG.js";

// ==========================================
// 🧠 Local RAG Retrieval Engine (Vector-Lite)
// ==========================================
function retrieveRelevantChunks(soil, plantName, statusSummary) {
  const queryTags = new Set();

  // 1. تحليل قراءات الحساس واستخراج الكلمات المفتاحية
  if (soil.ph > 7.3) {
    queryTags.add("ph");
    queryTags.add("alkaline");
    queryTags.add("caco3");
    queryTags.add("edta");
  }
  if (soil.ec > 1500) {
    queryTags.add("ec");
    queryTags.add("salinity");
    queryTags.add("gypsum");
  }
  if (soil.n < 100 || soil.p < 50 || soil.k < 150) {
    queryTags.add("nitrogen");
    queryTags.add("phosphorus");
    queryTags.add("potassium");
    queryTags.add("npk");
    queryTags.add("fertilizer");
  }
  
  // إضافة الكومبوست والـ Biochar دائماً للترب الجافة والقلوية
  queryTags.add("biochar");
  queryTags.add("compost");
  queryTags.add("humic");

  // 2. حساب درجة المطابقة (Scoring Algorithm) لكل Chunk في قاعدة RAG
  const scoredChunks = omanRAGData.knowledge_base.map(chunk => {
    let score = 0;
    chunk.tags.forEach(tag => {
      if (queryTags.has(tag)) score += 1;
    });
    return { ...chunk, relevanceScore: score };
  });

  // 3. ترتيب القطع المعرفية تنازلياً وأخذ أفضل 2-3 Chunks
  scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scoredChunks.slice(0, 3);
}

export default async function handler(req, res) {
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
    const soil = body.soil;
    const plantName = body.plantName || "غير محدد";
    const stage = body.stage || "غير محددة";
    const statusSummary = body.statusSummary || null;

    if (!soil) return res.status(400).send("Missing soil readings");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).send("Missing GEMINI_API_KEY");

    // 🔍 4. تنفيذ الاسترجاع المعرفي الحقيقي (RAG Retrieval Step)
    const retrievedChunks = retrieveRelevantChunks(soil, plantName, statusSummary);

    // صياغة النص المسترجع كـ Context موجه للموديل
    const ragContextText = retrievedChunks.map(c => 
      `[Chunk ID: ${c.chunk_id} | المصدر: ${c.metadata.source}]\n${c.content}`
    ).join("\n\n");

    const chunkIdsString = retrievedChunks.map(c => `[${c.chunk_id}]`).join(" ");

    // ===== Prompt الموجه لـ Gemini =====
    const promptText = `
أنت خبير زراعي ذكي ونظام تحليل متقدم باسم "نَسغ AI".

بيانات قراءات الحساس الحالية:
${JSON.stringify(soil, null, 2)}
نوع النبات: ${plantName}
مرحلة النمو: ${stage}

=== السياق المعرفي المباشر والمسترجع من قاعدة بيانات RAG العُمانية (Retrieved Context) ===
${ragContextText}

المطلوب:
اكتب توصية زراعية موجهة للمزارع العُماني بلغة عربية بسيطة ومباشرة:
1. ابدأ بـ "حياك أخوي".
2. قدم تحليلاً مختصراً لحالة التربة وبناءً على البيانات المسترجعة من الـ RAG (اششر إلى القلوية العمانية، استخدام مخلبات EDDHA/EDTA، أو الجبس والكمبوست حسب القراءات).
3. اختم التوصية بسطر مستقل يوضح المراجع الاسترجاعية التي استخدمتها الخوارزمية كالتالي بالضبط:
   "📌 مراجع الاسترجاع المعرفي (RAG): ${chunkIdsString}"
`;

    const payload = { contents: [{ parts: [{ text: promptText }] }] };
    const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro"];
    const baseUrl = "https://generativelanguage.googleapis.com/v1/models";

    for (const model of MODELS) {
      try {
        const response = await fetch(`${baseUrl}/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const json = await response.json();
        if (response.ok && json.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).send(json.candidates[0].content.parts[0].text.trim());
        }
      } catch (err) {
        continue;
      }
    }

    return res.status(500).send("Gemini RAG pipeline failed.");
  } catch (err) {
    return res.status(500).send("Server error: " + err.toString());
  }
}
