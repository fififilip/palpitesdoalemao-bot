const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const sessionPath = path.join(__dirname, "../auth");

console.log("🧹 Checking for old session files...");
if (fs.existsSync(sessionPath)) {
  fs.readdirSync(sessionPath).forEach((file) => {
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
    browser: ["Ubuntu", "Chrome", "22.04.4"],
  });

  console.log("🔌 WhatsApp client started");

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
      await onMessageReceived(msg.message.conversation);
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("📸 Scan this QR code to login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("🔁 Reconnecting to WhatsApp...");
        startWhatsAppConnection(onMessageReceived);
      } else {
        console.log("❌ Disconnected:", lastDisconnect?.error);
      }
    } else if (connection === "open") {
      console.log("✅ connected to WA");
    }
  });
}

module.exports = { startWhatsAppConnection };
