require('dotenv').config();
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

// Load from .env
const SOURCE_GROUP_ID = process.env.SOURCE_GROUP_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        startWhatsAppBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid !== SOURCE_GROUP_ID || msg.key.fromMe) return;

    try {
      const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (!textMessage) return;

      console.log(`💬 New message: ${textMessage}`);

      // Call GPT
      const response = await openai.chat.completions.create({
        model: openaiModel,
        messages: [{ role: 'user', content: textMessage }],
      });

      const gptReply = response.choices[0]?.message?.content?.trim();

      if (gptReply) {
        console.log(`🤖 GPT reply: ${gptReply}`);

        // Send to Telegram
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: gptReply,
          }),
        });
      }
    } catch (err) {
      console.error('❌ Error processing message:', err.message);
    }
  });
}

startWhatsAppBot();
