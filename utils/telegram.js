const axios = require("axios");

async function sendToTelegram(message) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: message
  };
  await axios.post(url, payload);
}

module.exports = { sendToTelegram };
