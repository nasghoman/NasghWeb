export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Only POST allowed", {
      status: 405,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  try {
    const body = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response("Missing GEMINI_API_KEY", {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const prompt = `
    حلل هذه القراءات الزراعية وأعطِ توصية مختصرة واحترافية بالعربية:
    ${JSON.stringify(body.soil, null, 2)}
    `;

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const geminiJson = await geminiRes.json();
    const reply =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "لم يصل رد من نموذج Gemini.";

    return new Response(reply, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/plain",
      },
    });

  } catch (err) {
    return new Response("Server Error: " + err.message, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
