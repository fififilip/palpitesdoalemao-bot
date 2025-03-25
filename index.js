require("dotenv").config();
const { startWhatsAppConnection } = require("./utils/whatsapp");
const { translateMessage } = require("./utils/translator");
const { sendToTelegram } = require("./utils/telegram");

startWhatsAppConnection(async (message) => {
  console.log("Received:", message);
  try {
    const translated = await translateMessage(message);
    await sendToTelegram(translated);
  } catch (err) {
    console.error("Error processing:", err.message);
  }
});
