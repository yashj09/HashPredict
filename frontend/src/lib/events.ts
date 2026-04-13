import { parseAbiItem } from "viem";
import { publicClient } from "./publicClient";
import { FACTORY_ADDRESS } from "./contracts";

// ---------- Block Range Helper ----------
// HashKey testnet has 26M+ blocks. Querying from "earliest" times out.
// Markets were created recently, so 5M blocks (~2 weeks) is more than enough.

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

export interface TradeEvent {
  user: `0x${string}`;
  isYes: boolean;
  collateralAmount: bigint; // collateralIn for buys, collateralOut for sells
  tokenAmount: bigint; // tokensOut for buys, tokensIn for sells
  type: "buy" | "sell";
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
  timestamp: number; // enriched after fetch
}

export interface ClaimEvent {
  user: `0x${string}`;
  amount: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
  timestamp: number;
}

export interface LiquidityEvent {
  provider: `0x${string}`;
  type: "add" | "remove";
  collateralAmount: bigint;
  shareAmount: bigint; // lpSharesMinted or lpSharesBurned
  blockNumber: bigint;
  logIndex: number;
}

export type MarketEvent =
  | (TradeEvent & { kind: "trade" })
  | (LiquidityEvent & { kind: "liquidity" });

// ---------- Event Signatures ----------

const BuyEvent = parseAbiItem(
  "event Buy(address indexed user, bool indexed isYes, uint256 collateralIn, uint256 tokensOut)"
);
const SellEvent = parseAbiItem(
  "event Sell(address indexed user, bool indexed isYes, uint256 tokensIn, uint256 collateralOut)"
);
const LiquidityAddedEvent = parseAbiItem(
  "event LiquidityAdded(address indexed provider, uint256 collateralAmount, uint256 lpSharesMinted)"
);
const LiquidityRemovedEvent = parseAbiItem(
  "event LiquidityRemoved(address indexed provider, uint256 lpSharesBurned, uint256 collateralOut)"
);
const WingsClaimedEvent = parseAbiItem(
  "event WinningsClaimed(address indexed user, uint256 amount)"
);
const MarketCreatedEvent = parseAbiItem(
  "event MarketCreated(address indexed market, address indexed creator, string question, string category, address collateralToken, uint256 endTimestamp, uint256 initialLiquidity)"
);

// ---------- Fetch Functions ----------

export async function fetchMarketTradeEvents(
  marketAddress: `0x${string}`,
  userFilter?: `0x${string}`
): Promise<TradeEvent[]> {
  try {
    const fromBlock = await getSafeFromBlock();
    const [buyLogs, sellLogs] = await Promise.all([
      publicClient.getLogs({
        address: marketAddress,
        event: BuyEvent,
        args: userFilter ? { user: userFilter } : undefined,
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: SellEvent,
        args: userFilter ? { user: userFilter } : undefined,
        fromBlock,
        toBlock: "latest",
      }),
    ]);

    const trades: TradeEvent[] = [
      ...buyLogs.map((log) => ({
        user: log.args.user!,
        isYes: log.args.isYes!,
        collateralAmount: log.args.collateralIn!,
        tokenAmount: log.args.tokensOut!,
        type: "buy" as const,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash!,
        logIndex: log.logIndex,
        timestamp: 0,
      })),
      ...sellLogs.map((log) => ({
        user: log.args.user!,
        isYes: log.args.isYes!,
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
    console.error("fetchMarketTradeEvents failed:", err);
    return [];
  }
}

export async function fetchMarketClaimEvents(
  marketAddress: `0x${string}`
): Promise<ClaimEvent[]> {
  try {
    const fromBlock = await getSafeFromBlock();
    const logs = await publicClient.getLogs({
      address: marketAddress,
      event: WingsClaimedEvent,
      fromBlock,
      toBlock: "latest",
    });

    return logs.map((log) => ({
      user: log.args.user!,
      amount: log.args.amount!,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash!,
      timestamp: 0,
    }));
  } catch (err) {
    console.error("fetchMarketClaimEvents failed:", err);
    return [];
  }
}

export async function fetchAllMarketEvents(
  marketAddress: `0x${string}`
): Promise<MarketEvent[]> {
  try {
    const fromBlock = await getSafeFromBlock();
    const [buyLogs, sellLogs, addLiqLogs, removeLiqLogs] = await Promise.all([
      publicClient.getLogs({
        address: marketAddress,
        event: BuyEvent,
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: SellEvent,
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: LiquidityAddedEvent,
        fromBlock,
        toBlock: "latest",
      }),
      publicClient.getLogs({
        address: marketAddress,
        event: LiquidityRemovedEvent,
        fromBlock,
        toBlock: "latest",
      }),
    ]);

    const events: MarketEvent[] = [
      ...buyLogs.map((log) => ({
        kind: "trade" as const,
        user: log.args.user!,
        isYes: log.args.isYes!,
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
        user: log.args.user!,
        isYes: log.args.isYes!,
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
        provider: log.args.provider!,
        type: "add" as const,
        collateralAmount: log.args.collateralAmount!,
        shareAmount: log.args.lpSharesMinted!,
        blockNumber: log.blockNumber,
        logIndex: log.logIndex,
      })),
      ...removeLiqLogs.map((log) => ({
        kind: "liquidity" as const,
        provider: log.args.provider!,
        type: "remove" as const,
        collateralAmount: log.args.collateralOut!,
        shareAmount: log.args.lpSharesBurned!,
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
    console.error("fetchAllMarketEvents failed:", err);
    return [];
  }
}

export async function fetchInitialLiquidity(
  marketAddress: `0x${string}`
): Promise<bigint> {
  try {
    const fromBlock = await getSafeFromBlock();
    const logs = await publicClient.getLogs({
      address: FACTORY_ADDRESS,
      event: MarketCreatedEvent,
      args: { market: marketAddress },
      fromBlock,
      toBlock: "latest",
    });

    if (logs.length === 0) throw new Error("MarketCreated event not found");
    return logs[0].args.initialLiquidity!;
  } catch (err) {
    console.error("fetchInitialLiquidity failed:", err);
    throw err;
  }
}

// ---------- Timestamp Enrichment ----------

export async function enrichWithTimestamps(
  blockNumbers: bigint[]
): Promise<Map<bigint, number>> {
  const unique = [...new Set(blockNumbers.map((b) => b.toString()))].map(
    BigInt
  );
  const timestamps = new Map<bigint, number>();

  try {
    // Batch in groups of 10 to avoid overloading RPC
    const batchSize = 10;
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const blocks = await Promise.all(
        batch.map((bn) => publicClient.getBlock({ blockNumber: bn }))
      );
      blocks.forEach((block, idx) => {
        timestamps.set(batch[idx], Number(block.timestamp));
      });
    }
  } catch (err) {
    console.error("enrichWithTimestamps failed:", err);
  }

  return timestamps;
}
