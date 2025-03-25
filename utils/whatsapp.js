const crypto = require("crypto-browserify");
const fs = require("fs");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");

const sessionPath = "/app/auth";

console.log("🧹 Checking for old session files...");
if (fs.existsSync(sessionPath)) {
  fs.readdirSync(sessionPath).forEach(file => {
    const filePath = path.join(sessionPath, file);
    if (fs.lstatSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
    }
  });
}

async function startWhatsAppConnection(onMessageReceived) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
      await onMessageReceived(msg.message.conversation);
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ Connected to WhatsApp");
    } else if (connection === "close") {
      console.log("❌ Disconnected:", lastDisconnect?.error);
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("🔁 Reconnecting to WhatsApp...");
        startWhatsAppConnection(onMessageReceived);
      }
    }
  });
}

module.exports = { startWhatsAppConnection };
