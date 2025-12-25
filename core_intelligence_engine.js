
import axios from "axios";

/* =========================
   ENV VARIABLES
========================= */
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing Telegram environment variables");
}

/* =========================
   TELEGRAM AGENT
========================= */
async function sendTelegram(text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text,
        parse_mode: "Markdown"
      }
    );
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

/* =========================
   STARTUP MESSAGE
========================= */
(async () => {
  await sendTelegram("🚀 *BOT ONLINE*\nMEXC pre-list scanner initialized.");
  console.log("✅ Bot initialized");
})();

/* =========================
   DEXSCREENER FETCH
========================= */
async function fetchDexPairs(chain) {
  try {
    const query = chain === "sol" ? "SOL" : "BSC";
    const res = await axios.get(
      `https://api.dexscreener.com/latest/dex/search?q=${query}`,
      { timeout: 15000 }
    );
    return res.data?.pairs || [];
  } catch (e) {
    console.error("Dex fetch error:", e.message);
    return [];
  }
}

/* =========================
   SAFE FILTERS
========================= */
function isGoodPair(pair) {
  try {
    if (!pair?.liquidity?.usd) return false;
    if (!pair?.volume?.h1) return false;
    if (!pair?.fdv) return false;

    if (pair.liquidity.usd < 20000) return false;
    if (pair.volume.h1 < 5000) return false;
    if (pair.fdv > 5_000_000) return false;

    return true;
  } catch {
    return false;
  }
}

/* =========================
   MAIN LOOP (LIGHT)
========================= */
async function scan() {
  console.log("🔍 Scanning...");

  const bscPairs = await fetchDexPairs("bsc");
  const solPairs = await fetchDexPairs("sol");

  const allPairs = [...bscPairs, ...solPairs];

  for (const pair of allPairs.slice(0, 5)) {
    if (!isGoodPair(pair)) continue;

    await sendTelegram(
      `🔥 *EARLY DEX SIGNAL*\n\n` +
      `🪙 ${pair.baseToken?.name} (${pair.baseToken?.symbol})\n` +
      `🌐 ${pair.chainId}\n` +
      `💧 Liquidity: $${Math.round(pair.liquidity.usd)}\n` +
      `📊 FDV: $${Math.round(pair.fdv)}\n` +
      `🔗 ${pair.url}`
    );
  }
}

/* =========================
   INTERVALS (SAFE)
========================= */
setInterval(scan, 120000); // every 2 mins
setInterval(() => console.log("💓 Bot alive"), 60000);
