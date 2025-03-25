const fs = require("fs");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");

const sessionPath = path.join(__dirname, "../auth");

// 🧼 Clean corrupted auth folder if necessary
if (fs.existsSync(sessionPath)) {
  const files = fs.readdirSync(sessionPath);
  if (files.length > 0) {
    console.log("⚠️ Clearing old session files from /auth");
    files.forEach(file => fs.unlinkSync(path.join(sessionPath, file)));
  }
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
    console.log("Incoming message from:", msg.key.remoteJid);

    if (!msg.key.fromMe && msg.message?.conversation) {
      await onMessageReceived(msg.message.conversation);
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) {
        startWhatsAppConnection(onMessageReceived);
      }
    }
  });
}

module.exports = { startWhatsAppConnection };
