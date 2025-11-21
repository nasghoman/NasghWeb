// api/soil-history.js

export default function handler(req, res) {
  const limit = parseInt(req.query.limit || "10", 10);

  // 🔹 بيانات تجريبية (Array فيها كذا قراءة)
  const now = Date.now();
  const demoHistory = [
    {
      id: "NASGH-1",
      t: 24.4,
      m: 38.7,
      ec: 1796,
      ph: 6.5,
      n: 14,
      p: 9,
      k: 21,
      shs: 76.2,
      hum: 41.3,
      stage: "مرحلة النمو الخضري",
      advice:
        "ري خفيف مع متابعة الرطوبة بعد 24 ساعة، ويفضل تسميد نيتروجيني خفيف الأسبوع الجاي.",
      timestamp: new Date(now - 0 * 3600 * 1000).toISOString()
    },
    {
      id: "NASGH-1",
      t: 23.8,
      m: 42.1,
      ec: 1650,
      ph: 6.3,
      n: 13,
      p: 8,
      k: 19,
      shs: 78.0,
      hum: 39.6,
      stage: "مرحلة النمو الخضري",
      advice:
        "الوضع طيب، فقط تأكد إن الري يكون في الصباح الباكر عشان تقلل التبخر.",
      timestamp: new Date(now - 6 * 3600 * 1000).toISOString()
    },
    {
      id: "NASGH-1",
      t: 25.1,
      m: 35.9,
      ec: 1900,
      ph: 6.7,
      n: 15,
      p: 10,
      k: 22,
      shs: 74.5,
      hum: 40.2,
      stage: "انتقال لنمو الأزهار",
      advice:
        "ابدأ خفف الري شوي وخلك حريص في التسميد البوتاسي لتهيئة النبات للإثمار.",
      timestamp: new Date(now - 12 * 3600 * 1000).toISOString()
    }
  ];

  const sliced = demoHistory.slice(0, limit);

  return res.status(200).json(sliced);
}
