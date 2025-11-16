export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  // ===== CORS =====
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
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).send("Missing Gemini API key on server");
    }

    const payload = {
      contents: [{
        parts: [{
          text:
            `هذه قراءات تربة: ${JSON.stringify(body.soil)}.
            قدّم توصية زراعية دقيقة بالعربية بخصوص الري، 
            التسميد، تحسين الحموضة، والملوحة.`
        }]
      }]
    };

    // 4 موديلات نجرّبهن بالترتيب
    const MODELS = [
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash"
    ];

    let lastError = null;

    for (const model of MODELS) {
      try {
        console.log("Trying model:", model);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res
            .status(200)
            .send(result.candidates[0].content.parts[0].text);
        }

        lastError = result.error || result;
      } catch (e) {
        lastError = e.message;
      }
    }

    return res.status(500).send(
      "Gemini API failed on all models. Last error: " + JSON.stringify(lastError)
    );

  } catch (err) {
    return res.status(500).send("Server error: " + err.message);
  }
}
