/**
 * UNIVERSAL PRESALE + PRE-LISTING INTELLIGENCE BOT
 * Single-file brain
 * Safe for GitHub (NO SECRETS HARDCODED)
 * Railway compatible
 */

import fetch from "node-fetch";
import crypto from "crypto";

/* =========================
   ENVIRONMENT VARIABLES
========================= */
const {
  OPENAI_API_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,

  // Block explorers
  BSCSCAN_API_KEY,

  // MEXC (optional private)
  MEXC_API_KEY,
  MEXC_API_SECRET,

  // Optional analytics
  COINMARKETCAP_API_KEY,
  MORALIS_API_KEY,
  LUNARCRUSH_API_KEY,
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error("Telegram credentials missing");
}

/* =========================
   GLOBAL CONFIG
========================= */
const CHAINS = [
  "bsc",
  "ethereum",
  "polygon",
  "avalanche",
  "base",
  "fantom",
  "arbitrum",
  "optimism",
  "solana"
];

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";
const MEXC_PUBLIC_API = "https://api.mexc.com";
const COINMARKETCAP_API = "https://pro-api.coinmarketcap.com";
const MORALIS_API = "https://deep-index.moralis.io/api/v2";
const LUNARCRUSH_API = "https://lunarcrush.com/api4";

/* =========================
   UTILS
========================= */
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function safeFetch(url: string, options: any = {}, retries = 3) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (retries > 0) {
      await sleep(1000);
      return safeFetch(url, options, retries - 1);
    }
    throw e;
  }
}

async function sendTelegram(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
}

/* =========================
   MEXC INTELLIGENCE
========================= */

// Coins visible but NOT tradable yet
async function getMexcSymbols() {
  const data = await safeFetch(`${MEXC_PUBLIC_API}/api/v3/exchangeInfo`);
  return data.symbols || [];
}

// Detect early deposits enabled
async function detectPreListing(symbols: any[]) {
  return symbols.filter(s =>
    s.status === "ENABLED" &&
    s.isSpotTradingAllowed === false
  );
}

/* =========================
   DEX EARLY DISCOVERY
========================= */
async function scanDexNewPairs() {
  const results: any[] = [];
  for (const chain of CHAINS) {
    try {
      const data = await safeFetch(`${DEXSCREENER_API}/pairs/${chain}`);
      if (data?.pairs) {
        const fresh = data.pairs.filter((p: any) =>
          p.pairCreatedAt > Date.now() - 60 * 60 * 1000
        );
        results.push(...fresh);
      }
    } catch {}
  }
  return results;
}

/* =========================
   WHALE + RISK FILTER
========================= */
function whaleScore(pair: any) {
  let score = 0;
  if (pair.liquidity?.usd > 20000) score += 2;
  if (pair.volume?.h1 > 10000) score += 2;
  if (pair.txns?.h1?.buys > pair.txns?.h1?.sells) score += 2;
  return score;
}

function rugFilter(pair: any) {
  if (!pair.liquidity || pair.liquidity.usd < 5000) return false;
  if (pair.fdv && pair.liquidity.usd / pair.fdv < 0.01) return false;
  return true;
}

/* =========================
   SOCIAL MOMENTUM
========================= */
async function socialScore(symbol: string) {
  let score = 0;

  if (LUNARCRUSH_API_KEY) {
    try {
      const data = await safeFetch(
        `${LUNARCRUSH_API}/assets?symbol=${symbol}`,
        { headers: { Authorization: `Bearer ${LUNARCRUSH_API_KEY}` } }
      );
      if (data?.data?.[0]?.social_volume > 1000) score += 2;
    } catch {}
  }

  return score;
}

/* =========================
   AI FINAL DECISION
========================= */
async function aiDecision(context: any) {
  if (!OPENAI_API_KEY) return "NO_AI_KEY";

  const prompt = `
You are an elite crypto presale sniper.
Evaluate this asset for a 30–60 min post-listing pump.
Respond only BUY or SKIP.

Data:
${JSON.stringify(context)}
`;

  const res = await safeFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    })
  });

  return res.choices[0].message.content;
}

/* =========================
   MAIN LOOP
========================= */
async function main() {
  await sendTelegram("🚀 Bot started — monitoring presales & pre-listings");

  while (true) {
    try {
      const mexcSymbols = await getMexcSymbols();
      const preListings = await detectPreListing(mexcSymbols);

      const dexPairs = await scanDexNewPairs();

      for (const pair of dexPairs) {
        if (!rugFilter(pair)) continue;

        const whale = whaleScore(pair);
        if (whale < 4) continue;

        const social = await socialScore(pair.baseToken.symbol);

        const decision = await aiDecision({
          pair,
          whale,
          social,
          preListings: preListings.some(p =>
            p.baseAsset === pair.baseToken.symbol
          )
        });

        if (decision.includes("BUY")) {
          await sendTelegram(
            `🔥 <b>PRESALE SIGNAL</b>\n\n` +
            `Token: ${pair.baseToken.symbol}\n` +
            `Chain: ${pair.chainId}\n` +
            `Liquidity: $${pair.liquidity.usd}\n` +
            `Volume 1h: $${pair.volume.h1}\n` +
            `Whale Score: ${whale}\n` +
            `Social Score: ${social}\n` +
            `Link: ${pair.url}`
          );
        }
      }
    } catch (e: any) {
      await sendTelegram(`⚠️ Error: ${e.message}`);
    }

    await sleep(60_000);
  }
}

main();
