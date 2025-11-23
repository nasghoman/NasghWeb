// api/soil-session.js

// تخزين مؤقت في الذاكرة (ممكن ينمسح بعد إعادة تشغيل السيرفر / الـ function)
let soilSessions = [];

/**
 * شكل الجلسة اللي بنحفظها من index.html:
 * {
 *   createdAt: "...",
 *   soil: { t, m, ec, ph, n, p, k, shs, hum, id },
 *   plantName: "ليمون",
 *   stage: "flowering",
 *   targets: { temp: {min,max}, ... },
 *   statusSummary: { temp: {status, value, min, max, label}, ... },
 *   advice: "نص التوصية ..."
 * }
 */

export default function handler(req, res) {
  // السماح فقط لـ GET و POST
  if (req.method === "POST") {
    const body = req.body || {};

    if (!body.soil) {
      return res.status(400).json({
        ok: false,
        error: "missing soil field in body",
      });
    }

    const session = {
      createdAt: body.createdAt || new Date().toISOString(),
      soil: body.soil,
      plantName: body.plantName || null,
      stage: body.stage || null,
      targets: body.targets || null,
      statusSummary: body.statusSummary || null,
      advice: body.advice || "",
    };

    // نخزن آخر الجلسات في الذاكرة
    soilSessions.unshift(session);
    soilSessions = soilSessions.slice(0, 100); // نخلي آخر 100 فقط

    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    const limit = parseInt(req.query.limit || "20", 10);
    return res.status(200).json(soilSessions.slice(0, limit));
  }

  // أي ميثود ثانية غير مسموحة
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
