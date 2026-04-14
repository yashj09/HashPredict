import "dotenv/config";
import cron from "node-cron";
import { createSlotJob } from "./jobs/createSlot.js";
import { resolveSlotsJob, registerPendingSlot } from "./jobs/resolveSlots.js";
import { recycleLiquidityJob, registerResolvedMarket } from "./jobs/recycleLiquidity.js";
import { scanSpeedMarkets } from "./jobs/scanMarkets.js";
import { startHealthServer, healthState } from "./monitoring/health.js";
import { SPEED_ASSETS, SLOT_DURATION } from "./config.js";

console.log("=".repeat(60));
console.log("  HashPredict Speed Market Keeper");
console.log("=".repeat(60));
console.log(`  Assets: ${SPEED_ASSETS.join(", ")}`);
console.log(`  Slot duration: ${SLOT_DURATION / 60} minutes`);
console.log(`  Create schedule: every ${SLOT_DURATION / 60} minutes`);
console.log(`  Resolve schedule: every minute`);
console.log(`  Recycle schedule: every 5 minutes`);
console.log("=".repeat(60));

// ---------------------------------------------------------------------------
// Transaction mutex — ALL chain-writing jobs must acquire this before sending
// any tx. Prevents nonce collisions between concurrent cron jobs.
// ---------------------------------------------------------------------------

let txLock: Promise<void> = Promise.resolve();

function withTxLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = txLock;
  let resolve: () => void;
  txLock = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

// ---------------------------------------------------------------------------
// Wrapped job runners with mutex + logging
// ---------------------------------------------------------------------------

async function wrappedCreateSlot() {
  return withTxLock(async () => {
    console.log(`\n[${new Date().toISOString()}] Running slot creation...`);
    try {
      await createSlotJob();
      healthState.lastSlotCreated = Date.now();
      healthState.slotsCreatedTotal += SPEED_ASSETS.length;
    } catch (err) {
      console.error("[Keeper] Slot creation failed:", err);
    }
  });
}

async function wrappedResolveSlots() {
  return withTxLock(async () => {
    try {
      await resolveSlotsJob();
    } catch (err) {
      console.error("[Keeper] Slot resolution failed:", err);
    }
  });
}

async function wrappedRecycleLiquidity() {
  return withTxLock(async () => {
    try {
      await recycleLiquidityJob();
    } catch (err) {
      console.error("[Keeper] Liquidity recycling failed:", err);
    }
  });
}

// ---------------------------------------------------------------------------
// Startup recovery — scan on-chain state, rebuild pending lists
// ---------------------------------------------------------------------------

async function startupRecovery() {
  console.log("\n[Keeper] Starting recovery scan...");

  try {
    const markets = await scanSpeedMarkets(80);
    const now = Math.floor(Date.now() / 1000);

    let activeCount = 0;
    let staleCount = 0;
    let resolvedCount = 0;

    for (const m of markets) {
      if (m.resolved) {
        resolvedCount++;
        // Check if LP needs recovering (recent resolved markets)
        if (now - m.expiry < 3600) {
          registerResolvedMarket(m.marketId);
        }
      } else if (m.expiry <= now) {
        staleCount++;
        // Expired but unresolved — register for resolution
        registerPendingSlot({
          marketId: m.marketId,
          asset: m.asset,
          expiry: m.expiry,
          strikePrice: m.strikePrice,
        });
      } else {
        activeCount++;
        // Active — register for future resolution
        registerPendingSlot({
          marketId: m.marketId,
          asset: m.asset,
          expiry: m.expiry,
          strikePrice: m.strikePrice,
        });
      }
    }

    console.log(
      `[Keeper] Recovery scan complete: ${markets.length} speed markets found ` +
        `(${activeCount} active, ${staleCount} stale, ${resolvedCount} resolved)`,
    );

    if (staleCount > 0) {
      console.log(`[Keeper] ${staleCount} stale market(s) will be resolved before creating new ones.`);
    }
  } catch (err) {
    console.error("[Keeper] Recovery scan failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Main startup sequence
// ---------------------------------------------------------------------------

async function main() {
  // Start health server immediately
  startHealthServer();

  // Step 1: Recover state from on-chain
  await startupRecovery();

  // Step 2: Resolve any stale markets, then create initial slots
  // This runs through the mutex so it's serialized
  await wrappedResolveSlots();
  await wrappedCreateSlot();

  // Step 3: Start cron jobs
  cron.schedule("*/15 * * * *", wrappedCreateSlot);
  cron.schedule("* * * * *", wrappedResolveSlots);
  cron.schedule("*/5 * * * *", wrappedRecycleLiquidity);

  console.log("\n[Keeper] Cron jobs started. Running...");
}

main().catch((err) => {
  console.error("[Keeper] Fatal startup error:", err);
  process.exit(1);
});
