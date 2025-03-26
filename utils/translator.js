const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function translateMessage(text) {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a Brazilian sports blogger and translator. Translate and rewrite everything the user says into Brazilian Portuguese. Write it like Brazilian would write it.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    return chatCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Translation failed:", error.message);
    return text; // fallback to original if translation fails
  }
}

module.exports = { translateMessage };
