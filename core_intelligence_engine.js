
import fetch from "node-fetch";

// --- Environment Variables ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// --- Function to send Telegram message ---
async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "Markdown"
    })
  });
}

// --- Startup ---
(async () => {
  try {
    await sendTelegram("✅ Bot initialized and awaiting signals");
    console.log("Startup message sent");

    // Placeholder for scanning logic
    console.log("Bot is now ready to scan for presales / pre-list coins...");

    // Example: main loop (placeholder)
    setInterval(async () => {
      console.log("Checking market for opportunities...");
      // Here is where you will later add:
      // BSC + Solana scans, AI filtering, whale detection, signal logic
      // For now this loop keeps the bot alive
    }, 60000); // every 60 seconds
  } catch (e) {
    console.error("Telegram error:", e.message);
  }
})();
