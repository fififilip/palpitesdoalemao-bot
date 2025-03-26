require('dotenv').config();
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { TelegramClient } = require('messaging-api-telegram');
const P = require('pino');
const axios = require('axios');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

// ENV variables
const allowedGroupId = process.env.SOURCE_GROUP_ID;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramTargetChatId = process.env.TELEGRAM_CHAT_ID;
const openAiApiKey = process.env.OPENAI_API_KEY;

const telegramClient = new TelegramClient({
  accessToken: telegramBotToken,
});

async function translateTextWithFallback(text) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a translation assistant. Translate everything the user says to English only. Do not reply or answer the message. Only translate.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Translation failed:', error.message);
    return `[Translation error: ${error.response?.data?.error?.message || error.message}]`;
  }
}

async function startWhatsAppBot() {
  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: P({ level: 'info' }),
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    if (sender !== allowedGroupId) return;

    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!messageContent) return;

    console.log('📨 Received:', messageContent);

    const translatedText = await translateTextWithFallback(messageContent);
    console.log('🔁 Translated:', translatedText);

    // Send to Telegram
    try {
      await telegramClient.sendMessage(telegramTargetChatId, translatedText);
      console.log('📤 Forwarded to Telegram');
    } catch (err) {
      console.error('❌ Error sending to Telegram:', err.message);
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('📴 Connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsAppBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });
}

startWhatsAppBot();
