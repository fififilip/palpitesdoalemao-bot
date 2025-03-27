const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const { Configuration, OpenAIApi } = require('openai');

dotenv.config();

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  OPENAI_API_KEY,
} = process.env;

const TARGET_WHATSAPP_GROUP = '120363399350692551@g.us';

const openai = new OpenAIApi(new Configuration({
  apiKey: OPENAI_API_KEY,
}));

async function translateText(text) {
  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Translate everything into natural English. Do not reply, only translate.',
        },
        { role: 'user', content: text },
      ],
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error);
    return '⚠️ Error translating message.';
  }
}

async function sendToTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error('Telegram send error:', await res.text());
    }
  } catch (error) {
    console.error('Telegram send error:', error);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    syncFullHistory: false,
    shouldSyncHistoryMessage: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.remoteJid !== TARGET_WHATSAPP_GROUP) return;
      const body = msg.message?.conversation;
      if (!body) return;

      console.log('Received:', body);

      const translated = await translateText(body);
      console.log('Translated:', translated);

      await sendToTelegram(translated);
    }
  });
}

startBot();
