import { parseAbiItem } from "viem";
import { publicClient } from "./publicClient";
import { SPEED_MARKET_ADDRESS } from "./contracts";
import { enrichWithTimestamps } from "./events";

// ---------- Block Range Helper ----------

const LOG_RANGE = 5_000_000n;

let cachedFromBlock: bigint | null = null;
let cacheTimestamp = 0;

async function getSafeFromBlock(): Promise<bigint> {
  const now = Date.now();
  if (cachedFromBlock && now - cacheTimestamp < 60_000) return cachedFromBlock;
  const current = await publicClient.getBlockNumber();
  cachedFromBlock = current > LOG_RANGE ? current - LOG_RANGE : 0n;
  cacheTimestamp = now;
  return cachedFromBlock;
}

// ---------- Types ----------

export interface SpeedTradeEvent {
  marketId: bigint;
  user: `0x${string}`;
  isUp: boolean;
  collateralAmount: bigint;
  tokenAmount: bigint;
  type: "buy" | "sell";
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
  timestamp: number;
}

export interface SpeedLiquidityEvent {
  marketId: bigint;
  provider: `0x${string}`;
  type: "add" | "remove";
  collateralAmount: bigint;
  shareAmount: bigint;
  blockNumber: bigint;
  logIndex: number;
}

export type SpeedMarketEvent =
  | (SpeedTradeEvent & { kind: "trade" })
  | (SpeedLiquidityEvent & { kind: "liquidity" });

// ---------- Event Signatures ----------

const SpeedBuyEvent = parseAbiItem(
  "event Buy(uint256 indexed marketId, address indexed user, bool indexed isUp, uint256 collateralIn, uint256 tokensOut)"
);
const SpeedSellEvent = parseAbiItem(
  "event Sell(uint256 indexed marketId, address indexed user, bool indexed isUp, uint256 tokensIn, uint256 collateralOut)"
);
const SpeedLiquidityAddedEvent = parseAbiItem(
  "event LiquidityAdded(uint256 indexed marketId, address indexed provider, uint256 amount, uint256 shares)"
);
const SpeedLiquidityRemovedEvent = parseAbiItem(
  "event LiquidityRemoved(uint256 indexed marketId, address indexed provider, uint256 shares, uint256 collateralOut)"
);

// ---------- Fetch Functions ----------

export async function fetchSpeedTradeEvents(
  marketId: bigint,
  userFilter?: `0x${string}`,
): Promise<SpeedTradeEvent[]> {
  try {
    const fromBlock = await getSafeFromBlock();
    const [buyLogs, sellLogs] = await Promise.all([
      publicClient.getLogs({
        address: SPEED_MARKET_ADDRESS,
        event: SpeedBuyEvent,
        args: { marketId, ...(userFilter ? { user: userFilter } : {}) },
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: SPEED_MARKET_ADDRESS,
        event: SpeedSellEvent,
        args: { marketId, ...(userFilter ? { user: userFilter } : {}) },
        fromBlock,
        toBlock: "latest",
      }),
    ]);

    const trades: SpeedTradeEvent[] = [
      ...buyLogs.map((log) => ({
        marketId: log.args.marketId!,
        user: log.args.user!,
        isUp: log.args.isUp!,
        collateralAmount: log.args.collateralIn!,
        tokenAmount: log.args.tokensOut!,
        type: "buy" as const,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
        logIndex: log.logIndex,
        timestamp: 0,
      })),
      ...sellLogs.map((log) => ({
        marketId: log.args.marketId!,
        user: log.args.user!,
        isUp: log.args.isUp!,
        collateralAmount: log.args.collateralOut!,
        tokenAmount: log.args.tokensIn!,
        type: "sell" as const,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
        logIndex: log.logIndex,
        timestamp: 0,
      })),
    ];

    return trades.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber)
        return Number(a.blockNumber - b.blockNumber);
      return a.logIndex - b.logIndex;
    });
  } catch (err) {
    console.error("fetchSpeedTradeEvents failed:", err);
    return [];
  }
}

export async function fetchAllSpeedMarketEvents(
  marketId: bigint,
): Promise<SpeedMarketEvent[]> {
  try {
    const fromBlock = await getSafeFromBlock();
    const [buyLogs, sellLogs, addLiqLogs, removeLiqLogs] = await Promise.all([
      publicClient.getLogs({
        address: SPEED_MARKET_ADDRESS,
        event: SpeedBuyEvent,
        args: { marketId },
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: SPEED_MARKET_ADDRESS,
        event: SpeedSellEvent,
        args: { marketId },
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: SPEED_MARKET_ADDRESS,
        event: SpeedLiquidityAddedEvent,
        args: { marketId },
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: SPEED_MARKET_ADDRESS,
        event: SpeedLiquidityRemovedEvent,
        args: { marketId },
        fromBlock,
        toBlock: "latest",
      }),
    ]);

    const events: SpeedMarketEvent[] = [
      ...buyLogs.map((log) => ({
        kind: "trade" as const,
        marketId: log.args.marketId!,
        user: log.args.user!,
        isUp: log.args.isUp!,
        collateralAmount: log.args.collateralIn!,
        tokenAmount: log.args.tokensOut!,
        type: "buy" as const,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
        logIndex: log.logIndex,
        timestamp: 0,
      })),
      ...sellLogs.map((log) => ({
        kind: "trade" as const,
        marketId: log.args.marketId!,
        user: log.args.user!,
        isUp: log.args.isUp!,
        collateralAmount: log.args.collateralOut!,
        tokenAmount: log.args.tokensIn!,
        type: "sell" as const,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
        logIndex: log.logIndex,
        timestamp: 0,
      })),
      ...addLiqLogs.map((log) => ({
        kind: "liquidity" as const,
        marketId: log.args.marketId!,
        provider: log.args.provider!,
        type: "add" as const,
        collateralAmount: log.args.amount!,
        shareAmount: log.args.shares!,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      })),
      ...removeLiqLogs.map((log) => ({
        kind: "liquidity" as const,
        marketId: log.args.marketId!,
        provider: log.args.provider!,
        type: "remove" as const,
        collateralAmount: log.args.collateralOut!,
        shareAmount: log.args.shares!,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      })),
    ];

    return events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber)
        return Number(a.blockNumber - b.blockNumber);
      return a.logIndex - b.logIndex;
    });
  } catch (err) {
    console.error("fetchAllSpeedMarketEvents failed:", err);
    return [];
  }
}

export { enrichWithTimestamps };
