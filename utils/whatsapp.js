const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");

const sessionPath = path.join(__dirname, "../auth");

// 🧼 Delete everything in /auth (including subfolders), except "lost+found"
if (fs.existsSync(sessionPath)) {
  const entries = fs.readdirSync(sessionPath);
  entries.forEach(entry => {
    const entryPath = path.join(sessionPath, entry);
    const stats = fs.lstatSync(entryPath);

    if (stats.isFile()) {
      fs.unlinkSync(entryPath);
    } else if (stats.isDirectory() && entry !== "lost+found") {
      fs.rmSync(entryPath, { recursive: true, force: true });
    }
  });
}

async function startWhatsAppConnection(onMessageReceived) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
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
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("🔁 Reconnecting to WhatsApp...");
        startWhatsAppConnection(onMessageReceived);
      } else {
        console.log("🚫 Logged out. Please restart and scan QR again.");
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connection established.");
    }

    if (update.qr) {
      console.log("📱 Scan this QR code with your WhatsApp app to connect.");
    }
  });
}

module.exports = { startWhatsAppConnection };
