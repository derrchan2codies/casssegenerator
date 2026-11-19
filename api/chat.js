// Master prompt. Replace this text with your own instructions.
// It is always sent before whatever is typed in the text box.
const SYSTEM_PROMPT = "What you will see after the question mark is an age of a human patient (the number will be between 1 and 115)  and the sex of that human (as in male or female) along with up to 10 different signs and symptoms and they will all be arranged in a way where each is seperated by a plus sign and that plus sign just mean everything is to be considered by you. You will take in the age, sex and all the signs and symptoms and first come up with one with one main diagnosis and once you have that main diagnosis write a main mock medical case on that main diagnosis and be extremely detailed like 200 words or so and include names and full history based on your differential and a full social history as well ? ";

const DEFAULT_MODEL = "gemini-4-neon";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function getAnswer(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];

    const text = parts
      .filter((part) => !part?.thought && typeof part?.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  return "";
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return json(
        { error: "GEMINI_API_KEY is missing in Vercel environment variables." },
        500,
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const prompt =
      typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return json({ error: "Please enter a question." }, 400);
    }

    const model =
      (process.env.GEMINI_MODEL || DEFAULT_MODEL)
        .trim()
        .replace(/^models\//, "") || DEFAULT_MODEL;

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      const data = await geminiResponse.json().catch(() => ({}));

      if (!geminiResponse.ok) {
        const message =
          typeof data?.error?.message === "string"
            ? data.error.message
            : `Gemini returned status ${geminiResponse.status}.`;

        console.error("Gemini API error:", geminiResponse.status, message);

        // Shows the real setup error in your webpage while testing.
        return json({ error: message }, geminiResponse.status);
      }

      const answer = getAnswer(data);

      if (!answer) {
        console.error("Gemini returned no text:", data);
        return json(
          { error: "The assistant returned an empty response." },
          502,
        );
      }

      return json({ answer });
    } catch (error) {
      console.error("Chat function failed:", error);

      return json(
        { error: "Could not contact Gemini. Check Vercel Function Logs." },
        502,
      );
    }
  },
};
