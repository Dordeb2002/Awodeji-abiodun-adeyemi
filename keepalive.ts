/**
 * KEEP-ALIVE + HEALTH MONITOR
 * Prevents Railway free tier sleep
 */

import http from "http";

const PORT = process.env.PORT || 3000;

http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot alive ✅");
}).listen(PORT, () => {
  console.log(`Keepalive running on port ${PORT}`);
});

/**
 * OPTIONAL:
 * Use UptimeRobot / cron-job.org
 * Ping this Railway URL every 5 minutes
 */
