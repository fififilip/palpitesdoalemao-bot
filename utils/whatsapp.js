const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

// Set auth session directory
const sessionPath = path.join(__dirname, "../auth");

// Optional: clean up broken app state files that may cause sync errors
console.log("🧹 Checking for old corrupted app state files...");
if (fs.existsSync(sessionPath)) {
  fs.readdirSync(sessionPath).forEach((file) => {
    const filePath = path.join(sessionPath, file);
    if (file.startsWith("app-state-")) {
      console.log(`🗑 Removing corrupted app state: ${file}`);
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

  // Message listener
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.key.fromMe && msg.message?.conversation) {
      const chatId = msg.key.remoteJid;
      const senderId = msg.key.participant || msg.key.remoteJid;
      const content = msg.message.conversation;

      console.log("💬 New Message:");
      console.log("   From:", senderId);
      console.log("   Chat:", chatId);
      console.log("   Text:", content);

      await onMessageReceived(content, chatId, senderId);
    }
  });

  // QR and connection handling
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
      console.log("✅ Connected to WhatsApp");
    }
  });
}

module.exports = { startWhatsAppConnection };
