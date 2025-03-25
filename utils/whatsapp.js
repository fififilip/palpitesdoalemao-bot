const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

async function startWhatsAppConnection(onMessageReceived) {
  const sessionPath = path.join(__dirname, "../auth");

  console.log("🧹 Checking for old session files...");
  if (fs.existsSync(sessionPath)) {
    fs.readdirSync(sessionPath).forEach(file => {
      const filePath = path.join(sessionPath, file);
      if (fs.lstatSync(filePath).isFile() && file.endsWith(".json")) {
        console.log("🗑️ Removing", filePath);
        fs.unlinkSync(filePath);
      }
    });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
      console.log("📩 Incoming message:", msg.message.conversation);
      await onMessageReceived(msg.message.conversation);
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📱 Scan this QR code to connect WhatsApp:");
      console.log(qr);
    }

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) {
        console.log("🔁 Reconnecting to WhatsApp...");
        startWhatsAppConnection(onMessageReceived);
      } else {
        console.log("❌ Logged out from WhatsApp");
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connection opened");
    }
  });

  console.log("🔌 WhatsApp client started");
}

module.exports = { startWhatsAppConnection };
