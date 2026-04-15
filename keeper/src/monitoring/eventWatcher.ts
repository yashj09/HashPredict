/**
 * Live on-chain event watcher for demo purposes.
 * Watches SpeedMarketAMM events and logs them with rich formatting.
 * Great for recording demo videos — judges see real tx activity.
 */

import { parseAbiItem, formatUnits, type Log } from "viem";
import { publicClient } from "../clients.js";
import { SPEED_MARKET_ADDRESS } from "../config.js";

// ─── Event signatures ────────────────────────────────────

const events = {
  Buy: parseAbiItem(
    "event Buy(uint256 indexed marketId, address indexed user, bool indexed isUp, uint256 collateralIn, uint256 tokensOut)"
  ),
  Sell: parseAbiItem(
    "event Sell(uint256 indexed marketId, address indexed user, bool indexed isUp, uint256 tokensIn, uint256 collateralOut)"
  ),
  Claimed: parseAbiItem(
    "event Claimed(uint256 indexed marketId, address indexed user, uint256 amount)"
  ),
  MarketCreated: parseAbiItem(
    "event MarketCreated(uint256 indexed marketId, string asset, uint256 strikePrice, uint64 expiry, uint256 initialLiquidity)"
  ),
  MarketResolved: parseAbiItem(
    "event MarketResolved(uint256 indexed marketId, bool outcomeIsUp)"
  ),
};

// ─── ANSI colors for terminal output ─────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m",
  bgCyan: "\x1b[46m",
  bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m",
};

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtUSDT(val: bigint): string {
  return parseFloat(formatUnits(val, 6)).toFixed(2);
}

function fmtPrice(val: bigint): string {
  const price = Number(val) / 1e8;
  return price >= 1000
    ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toFixed(4);
}

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function divider() {
  console.log(`${c.dim}${"─".repeat(70)}${c.reset}`);
}

// ─── Event handlers ──────────────────────────────────────

function handleBuy(log: any) {
  const { marketId, user, isUp, collateralIn, tokensOut } = log.args;
  const side = isUp ? `${c.green}${c.bold}UP${c.reset}` : `${c.red}${c.bold}DOWN${c.reset}`;
  const arrow = isUp ? `${c.green}▲${c.reset}` : `${c.red}▼${c.reset}`;

  divider();
  console.log(
    `${c.cyan}${c.bold} ⚡ BUY ${c.reset}  ${arrow} ${side}  ` +
    `${c.white}$${fmtUSDT(collateralIn)} USDT${c.reset}  →  ` +
    `${c.white}${fmtUSDT(tokensOut)} tokens${c.reset}`
  );
  console.log(
    `${c.dim}   Market #${marketId}  |  Trader: ${shortAddr(user)}  |  ${timestamp()}  |  tx: ${log.transactionHash.slice(0, 10)}...${c.reset}`
  );
}

function handleSell(log: any) {
  const { marketId, user, isUp, tokensIn, collateralOut } = log.args;
  const side = isUp ? `${c.green}UP${c.reset}` : `${c.red}DOWN${c.reset}`;

  divider();
  console.log(
    `${c.yellow}${c.bold} 💰 SELL ${c.reset}  ${side}  ` +
    `${c.white}${fmtUSDT(tokensIn)} tokens${c.reset}  →  ` +
    `${c.white}$${fmtUSDT(collateralOut)} USDT${c.reset}`
  );
  console.log(
    `${c.dim}   Market #${marketId}  |  Trader: ${shortAddr(user)}  |  ${timestamp()}  |  tx: ${log.transactionHash.slice(0, 10)}...${c.reset}`
  );
}

function handleClaimed(log: any) {
  const { marketId, user, amount } = log.args;

  divider();
  console.log(
    `${c.green}${c.bold} 🎉 CLAIM ${c.reset}  ` +
    `${c.white}$${fmtUSDT(amount)} USDT${c.reset} claimed!`
  );
  console.log(
    `${c.dim}   Market #${marketId}  |  Winner: ${shortAddr(user)}  |  ${timestamp()}  |  tx: ${log.transactionHash.slice(0, 10)}...${c.reset}`
  );
}

function handleMarketCreated(log: any) {
  const { marketId, asset, strikePrice, expiry, initialLiquidity } = log.args;
  const expiryDate = new Date(Number(expiry) * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  divider();
  console.log(
    `${c.magenta}${c.bold} 🆕 NEW MARKET ${c.reset}  ` +
    `${c.bold}${asset}${c.reset}  Strike: ${c.white}$${fmtPrice(strikePrice)}${c.reset}  ` +
    `Expires: ${c.white}${expiryDate}${c.reset}`
  );
  console.log(
    `${c.dim}   Market #${marketId}  |  Liquidity: $${fmtUSDT(initialLiquidity)}  |  ${timestamp()}  |  tx: ${log.transactionHash.slice(0, 10)}...${c.reset}`
  );
}

function handleMarketResolved(log: any) {
  const { marketId, outcomeIsUp } = log.args;
  const outcome = outcomeIsUp
    ? `${c.green}${c.bold}▲ UP${c.reset}`
    : `${c.red}${c.bold}▼ DOWN${c.reset}`;

  divider();
  console.log(
    `${c.blue}${c.bold} ✅ RESOLVED ${c.reset}  Market #${marketId}  →  ${outcome}`
  );
  console.log(
    `${c.dim}   ${timestamp()}  |  tx: ${log.transactionHash.slice(0, 10)}...${c.reset}`
  );
}

// ─── Start watcher ───────────────────────────────────────

export async function startEventWatcher() {
  console.log(`\n${c.cyan}${c.bold}[EventWatcher]${c.reset} Watching SpeedMarketAMM on-chain events...`);
  console.log(`${c.dim}[EventWatcher] Contract: ${SPEED_MARKET_ADDRESS}${c.reset}`);

  // Watch Buy events
  publicClient.watchEvent({
    address: SPEED_MARKET_ADDRESS,
    event: events.Buy,
    onLogs: (logs) => logs.forEach(handleBuy),
  });

  // Watch Sell events
  publicClient.watchEvent({
    address: SPEED_MARKET_ADDRESS,
    event: events.Sell,
    onLogs: (logs) => logs.forEach(handleSell),
  });

  // Watch Claimed events
  publicClient.watchEvent({
    address: SPEED_MARKET_ADDRESS,
    event: events.Claimed,
    onLogs: (logs) => logs.forEach(handleClaimed),
  });

  // Watch MarketCreated events
  publicClient.watchEvent({
    address: SPEED_MARKET_ADDRESS,
    event: events.MarketCreated,
    onLogs: (logs) => logs.forEach(handleMarketCreated),
  });

  // Watch MarketResolved events
  publicClient.watchEvent({
    address: SPEED_MARKET_ADDRESS,
    event: events.MarketResolved,
    onLogs: (logs) => logs.forEach(handleMarketResolved),
  });

  console.log(`${c.cyan}${c.bold}[EventWatcher]${c.reset} Listening for: Buy, Sell, Claim, MarketCreated, MarketResolved\n`);
}
