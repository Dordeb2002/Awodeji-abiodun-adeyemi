import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

/* =========================
   ENV VARIABLES
========================= */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const KEEPALIVE_URL = process.env.KEEPALIVE_URL || "https://your-project.up.railway.app/";

/* =========================
   TELEGRAM AGENT
========================= */
async function sendTelegram(text) {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown"
      })
    });
  } catch (err) {
    console.error("Telegram error:", err.message);
  }
}

/* =========================
   STARTUP MESSAGE
========================= */
(async () => {
  try {
    await sendTelegram("🚀 *MEXC PRE-LIST AI BOT INITIALIZED*\nAwaiting signals...");
    console.log("Bot initialized and awaiting signals...");
  } catch (err) {
    console.error("Startup Telegram error:", err.message);
  }
})();

/* =========================
   KEEPALIVE AGENT
========================= */
async function keepAlivePing() {
  try {
    await fetch(KEEPALIVE_URL);
    console.log("💡 Keepalive ping sent");
  } catch (err) {
    console.error("Keepalive error:", err.message);
  }
}

// Ping Railway every 5 minutes to prevent sleep
setInterval(keepAlivePing, 5 * 60_000);

/* =========================
   MEXC + DEX SCANNERS
========================= */
async function fetchMexcListings() {
  try {
    const res = await fetch("https://www.mexc.com/open/api/v2/market/symbols");
    const data = await res.json();
    return data?.data || [];
  } catch {
    return [];
  }
}

async function fetchDexPairs(chain = "bsc") {
  const url =
    chain === "sol"
      ? "https://api.dexscreener.com/latest/dex/search?q=SOL"
      : "https://api.dexscreener.com/latest/dex/search?q=BSC";

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data?.pairs || [];
  } catch {
    return [];
  }
}

/* =========================
   AGENT FILTERS
========================= */
function liquidityCheck(pair) {
  return pair?.liquidity?.usd > 20000;
}

function marketCapCheck(pair) {
  return pair?.fdv && pair.fdv < 5_000_000;
}

function volumeCheck(pair) {
  return pair?.volume?.h1 > 5000;
}

function rugCheck(pair) {
  if (!pair?.txns?.h1) return false;
  return pair.txns.h1.buys > pair.txns.h1.sells;
}

function whaleCheck(pair) {
  return pair?.txns?.h1?.buys >= 5;
}

function socialSignal(pair) {
  const nameLen = pair?.baseToken?.name?.length || 0;
  const symbol = pair?.baseToken?.symbol || "";
  return nameLen < 10 || symbol.includes("AI") || symbol.includes("DOG");
}

/* =========================
   AI SCORING (OpenAI)
========================= */
async function aiScore(pair) {
  if (!OPENAI_API_KEY) return 70;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Score this token for post-listing pump potential (0-100):
Liquidity: ${pair?.liquidity?.usd || 0}
Volume: ${pair?.volume?.h1 || 0}
FDV: ${pair?.fdv || 0}`
          }
        ]
      })
    });

    const data = await res.json();
    const scoreStr = data?.choices?.[0]?.message?.content || "70";
    const score = parseInt(scoreStr.match(/\d+/));
    return isNaN(score) ? 70 : score;
  } catch {
    return 70;
  }
}

/* =========================
   MASTER FILTER
========================= */
async function evaluatePair(pair) {
  try {
    if (!liquidityCheck(pair)) return null;
    if (!marketCapCheck(pair)) return null;
    if (!volumeCheck(pair)) return null;
    if (!rugCheck(pair)) return null;
    if (!whaleCheck(pair)) return null;
    if (!socialSignal(pair)) return null;

    const score = await aiScore(pair);
    if (score < 75) return null;

    return {
      name: pair?.baseToken?.name || "Unknown",
      symbol: pair?.baseToken?.symbol || "UNK",
      chain: pair?.chainId || "Unknown",
      price: pair?.priceUsd || 0,
      liquidity: pair?.liquidity?.usd || 0,
      fdv: pair?.fdv || 0,
      score,
      url: pair?.url || "N/A"
    };
  } catch {
    return null;
  }
}

/* =========================
   MAIN LOOP
========================= */
async function mainLoop() {
  try {
    const pairs = [
      ...(await fetchDexPairs("bsc")),
      ...(await fetchDexPairs("sol"))
    ];

    for (const pair of pairs) {
      const result = await evaluatePair(pair);
      if (!result) continue;

      await sendTelegram(
        `🔥 *PRE-MEXC ALPHA DETECTED*\n\n` +
        `🪙 ${result.name} (${result.symbol})\n` +
        `🌐 ${result.chain}\n` +
        `💧 Liquidity: $${result.liquidity}\n` +
        `📊 FDV: $${result.fdv}\n` +
        `🤖 AI Score: ${result.score}\n` +
        `🔗 ${result.url}`
      );
    }
  } catch (err) {
    console.error("Main loop error:", err.message);
  }
}

/* =========================
   RUN LOOP + HEARTBEAT
========================= */
setInterval(mainLoop, 60_000);
setInterval(() => console.log("💓 Bot heartbeat - running..."), 60_000);
