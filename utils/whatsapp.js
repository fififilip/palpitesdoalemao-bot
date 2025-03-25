const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const path = require("path");

const sessionId = Date.now().toString(); // Creates a unique folder each time
const sessionPath = path.join(__dirname, `../auth/${sessionId}`);

async function startWhatsAppConnection(onMessageReceived) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    console.log("Incoming message from:", msg.key.remoteJid); // Shows group ID

    if (
      !msg.key.fromMe &&
      msg.message?.conversation
    ) {
      await onMessageReceived(msg.message.conversation);
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) {
        startWhatsAppConnection(onMessageReceived); // Reconnect on disconnect
      }
    }
  });
}

module.exports = { startWhatsAppConnection };
