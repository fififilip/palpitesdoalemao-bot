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

// Don't delete session files every time!
if (!fs.existsSync(sessionPath)) {
  fs.mkdirSync(sessionPath, { recursive: true });
}

async function startWhatsAppConnection(onMessageReceived) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    browser: ["Ubuntu", "Chrome", "22.04.4"],
    printQRInTerminal: true,
  });

  console.log("🔌 WhatsApp client started");

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    const content = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text;

    const senderJid = msg?.key?.remoteJid || "";
    const isGroup = senderJid.endsWith("@g.us");

    // Optional: Filter only messages from a specific group
    const allowedGroupJid = process.env.WHATSAPP_GROUP_ID; // Add this to your .env

    if (!msg.key.fromMe && content) {
      if (!isGroup || senderJid === allowedGroupJid) {
        console.log(`📥 Message received from ${senderJid}: ${content}`);
        try {
          await onMessageReceived(content);
        } catch (err) {
          console.error("❌ Error processing message:", err.message);
        }
      } else {
        console.log(`⚠️ Ignored message from another group: ${senderJid}`);
      }
    }
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("📸 Scan this QR code to login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log("🔁 Reconnecting to WhatsApp...");
        startWhatsAppConnection(onMessageReceived);
      } else {
        console.log("❌ Disconnected from WhatsApp:", lastDisconnect?.error);
      }
    } else if (connection === "open") {
      console.log("✅ Connected to WhatsApp");
    }
  });
}

module.exports = { startWhatsAppConnection };
