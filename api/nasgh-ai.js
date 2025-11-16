export const config = {
  runtime: "nodejs"
};

// نستدعي الـ API من Google AI
import { GoogleGenerativeAI } from "@google/generative-ai";

// قائمة الموديلات اللي نجربها
const MODELS = [
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.0-pro",
  "gemini-1.0-pro-vision"
];

export default async function handler(req, res) {
  // السماح بالـ CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Only POST allowed");
  }

  try {
    // قراءة البودي بشكل متوافق مع Node (بدل req.json)
    const bodyString = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", err => reject(err));
    });

    const body = JSON.parse(bodyString);
    const { soil, language } = body;

    if (!soil) {
      return res.status(400).send("Missing soil readings");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send("Missing Gemini API Key");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    let lastError = "";
    let reply = null;

    // تجربة الموديلات واحد واحد
    for (let modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });

        const prompt = `
        حلّل القراءات التالية للتربة وأعطني توصية واضحة ومختصرة للري والتسميد بدون حشو:
        ${JSON.stringify(soil, null, 2)}
        اللغة المطلوبة: ${language || "ar"}
        `;

        const result = await model.generateContent(prompt);
        const text = await result.response.text();

        reply = `Model used: ${modelName}\n\n${text}`;
        break; // نجح.. نخرج من اللوب
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!reply) {
      return res
        .status(500)
        .send("Gemini API failed on all models. Last error: " + lastError);
    }

    res.status(200).send(reply);
  } catch (error) {
    res.status(500).send("Server error: " + error.toString());
  }
}
