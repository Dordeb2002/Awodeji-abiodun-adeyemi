
import fetch from "node-fetch";

/* =========================
   ENV VARIABLES (RAILWAY)
========================= */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   TELEGRAM AGENT
========================= */
async function sendTelegram(text) {
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
}

/* =========================
   STARTUP MESSAGE (IMPORTANT)
========================= */
(async () => {
  try {
    await sendTelegram("🚀 *MEXC PRE-LIST AI BOT INITIALIZED*\nAwaiting signals...");
    console.log("Bot initialized");
  } catch (e) {
    console.error("Telegram startup error:", e.message);
  }
})();

/* =========================
   MEXC LISTING AGENT
   (Pre-list + Dashboard)
========================= */
async function fetchMexcListings() {
  try {
    const res = await fetch("https://www.mexc.com/open/api/v2/market/symbols");
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/* =========================
   ON-CHAIN DEX SCANNER
   (BSC + SOL)
========================= */
async function fetchDexPairs(chain = "bsc") {
  const url =
    chain === "sol"
      ? "https://api.dexscreener.com/latest/dex/search?q=SOL"
      : "https://api.dexscreener.com/latest/dex/search?q=BSC";

  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.pairs || [];
  } catch {
    return [];
  }
}

/* =========================
   LIQUIDITY AGENT
========================= */
function liquidityCheck(pair) {
  return pair.liquidity?.usd > 20000;
}

/* =========================
   MARKET CAP AGENT
========================= */
function marketCapCheck(pair) {
  return pair.fdv && pair.fdv < 5_000_000;
}

/* =========================
   VOLUME AGENT
========================= */
function volumeCheck(pair) {
  return pair.volume?.h1 > 5000;
}

/* =========================
   RUG / HONEYPOT HEURISTIC
========================= */
function rugCheck(pair) {
  if (!pair.txns) return false;
  return pair.txns.h1.buys > pair.txns.h1.sells;
}

/* =========================
   WHALE ENTRY AGENT
========================= */
function whaleCheck(pair) {
  return pair.txns?.h1?.buys >= 5;
}

/* =========================
   SOCIAL / NARRATIVE AGENT
========================= */
function socialSignal(pair) {
  return (
    pair.baseToken?.name?.length < 10 ||
    pair.baseToken?.symbol?.includes("AI") ||
    pair.baseToken?.symbol?.includes("DOG")
  );
}

/* =========================
   AI SCORING AGENT (OpenAI)
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
Liquidity: ${pair.liquidity?.usd}
Volume: ${pair.volume?.h1}
FDV: ${pair.fdv}`
          }
        ]
      })
    });

    const data = await res.json();
    const score = parseInt(data.choices[0].message.content.match(/\d+/));
    return isNaN(score) ? 70 : score;
  } catch {
    return 70;
  }
}

/* =========================
   MASTER FILTER (NOT TOO TIGHT)
========================= */
async function evaluatePair(pair) {
  if (!liquidityCheck(pair)) return null;
  if (!marketCapCheck(pair)) return null;
  if (!volumeCheck(pair)) return null;
  if (!rugCheck(pair)) return null;
  if (!whaleCheck(pair)) return null;
  if (!socialSignal(pair)) return null;

  const score = await aiScore(pair);
  if (score < 75) return null;

  return {
    name: pair.baseToken.name,
    symbol: pair.baseToken.symbol,
    chain: pair.chainId,
    price: pair.priceUsd,
    liquidity: pair.liquidity.usd,
    fdv: pair.fdv,
    score,
    url: pair.url
  };
}

/* =========================
   CORE LOOP
========================= */
async function mainLoop() {
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
}

/* =========================
   RUN EVERY 60 SECONDS
========================= */
setInterval(mainLoop, 60_000);
setInterval(() => {
  console.log("Bot heartbeat - still running");
}, 60_000);
