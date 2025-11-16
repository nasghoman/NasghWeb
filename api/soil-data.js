// api/soil-data.js

export const config = {
  runtime: "nodejs",
};

let lastReading = null;

export default async function handler(req, res) {
  // السماح للمتصفح بالوصول من أي دومين (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "POST") {
    try {
      const chunks = [];

      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        try {
          const bodyString = Buffer.concat(chunks).toString("utf8");
          const data = JSON.parse(bodyString);

          // نخزّن آخر قراءة فقط في الذاكرة
          lastReading = data;

          console.log("✅ New soil reading stored:", data);
          return res.status(200).send("OK");
        } catch (err) {
          console.error("JSON parse error in POST /api/soil-data:", err);
          return res.status(400).send("Invalid JSON");
        }
      });
    } catch (err) {
      console.error("Error in POST /api/soil-data:", err);
      return res.status(500).send("Server error");
    }
    return;
  }

  if (req.method === "GET") {
    if (!lastReading) {
      return res.status(200).json({});
    }
    return res.status(200).json(lastReading);
  }

  return res.status(405).send("Method Not Allowed");
}
