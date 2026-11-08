// Master prompt. Replace this text with your own instructions.
// It is always sent before whatever is typed in the text box.
const SYSTEM_PROMPT = "What you will see after the question mark is an age of a human patient (the number will be between 1 and 115)  and the sex of that human (as in male or female) along with up to 10 different signs and symptoms and they will all be arranged in a way where each is seperated by a plus sign and that plus sign just mean everything is to be considered by you. You will take in the age, sex and all the signs and symptoms and first come up with one with one main diagnosis and once you have that main diagnosis write a main mock medical case on that main diagnosis and be extremely detailed like 200 words or so and include names and full history based on your differential and a full social history as well ? ";

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
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];

  return output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .filter((item) => item?.type === "output_text")
    .map((item) => item.text)
    .filter((text) => typeof text === "string")
    .join("\n")
    .trim();
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return json(
        { error: "OPENAI_API_KEY is missing in Vercel environment variables." },
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

    try {
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-6-luna",
            input: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
          }),
        },
      );

      const data = await openaiResponse.json().catch(() => ({}));

      if (!openaiResponse.ok) {
        const message =
          typeof data?.error?.message === "string"
            ? data.error.message
            : `OpenAI returned status ${openaiResponse.status}.`;

        console.error("OpenAI API error:", openaiResponse.status, message);

        // Shows the real setup error in your webpage while testing.
        return json({ error: message }, openaiResponse.status);
      }

      const answer = getAnswer(data);

      if (!answer) {
        console.error("OpenAI returned no text:", data);
        return json(
          { error: "The assistant returned an empty response." },
          502,
        );
      }

      return json({ answer });
    } catch (error) {
      console.error("Chat function failed:", error);

      return json(
        { error: "Could not contact OpenAI. Check Vercel Function Logs." },
        502,
      );
    }
  },
};
