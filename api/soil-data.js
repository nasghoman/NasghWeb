// api/soil-data.js

export default function handler(req, res) {
  // 🔹 بيانات تجريبية (بدل قاعدة البيانات الحقيقية)
  const sampleReading = {
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
      "ري خفيف اليوم مع التأكد من عدم تجمع الماء حول الجذور، ويفضّل تأجيل أي تسميد قوي.",
    timestamp: new Date().toISOString()
  };

  if (req.method === "GET") {
    // يرجّع آخر قراءة (Demo)
    return res.status(200).json(sampleReading);
  }

  if (req.method === "POST") {
    // هنا مستقبل قراءات من ESP32 لو حاب تربطها مستقبلاً
    // في الوضع الحالي ما نخزن شيء فعلياً (لأن السيرفر Serverless بدون DB).
    const body = req.body || {};
    console.log("Received soil-data POST (demo):", body);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
