"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchAllMarketEvents,
  fetchInitialLiquidity,
  enrichWithTimestamps,
  type MarketEvent,
} from "@/lib/events";

export interface PricePoint {
  timestamp: number;
  yesPrice: number; // 0–100 percentage
  blockNumber: bigint;
}

const FEE_BPS = 200n;
const BPS = 10_000n;

/**
 * Reconstructs price history by replaying all market events against the
 * exact CPMM math from PredictionMarket.sol (BigInt integer division).
 */
export function usePriceHistory(marketAddress: `0x${string}`) {
  return useQuery<PricePoint[]>({
    queryKey: ["priceHistory", marketAddress],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const [initialLiquidity, events] = await Promise.all([
        fetchInitialLiquidity(marketAddress),
        fetchAllMarketEvents(marketAddress),
      ]);

      // Track state — mirrors PredictionMarket.sol storage
      let yesReserve = initialLiquidity;
      let noReserve = initialLiquidity;
      let totalCollateral = initialLiquidity;
      let totalLpShares = initialLiquidity;

      const points: PricePoint[] = [];

      // Starting point: 50/50
      const firstBlock = events.length > 0 ? events[0].blockNumber : 0n;
      points.push({
        timestamp: 0,
        yesPrice: 50,
        blockNumber: firstBlock > 0n ? firstBlock - 1n : 0n,
      });

      for (const event of events) {
        if (event.kind === "trade") {
          if (event.type === "buy") {
            // PredictionMarket.sol lines 147–181
            const fee = (event.collateralAmount * FEE_BPS) / BPS;
            const effective = event.collateralAmount - fee;

            if (event.isYes) {
              const k = yesReserve * noReserve;
              const newNoReserve = noReserve + effective;
              const newYesReserve = k / newNoReserve;
              yesReserve = newYesReserve;
              noReserve = newNoReserve;
            } else {
              const k = yesReserve * noReserve;
              const newYesReserve = yesReserve + effective;
              const newNoReserve = k / newYesReserve;
              yesReserve = newYesReserve;
              noReserve = newNoReserve;
            }
            totalCollateral += effective;
          } else {
            // Sell — PredictionMarket.sol lines 194–230
            if (event.isYes) {
              const k = yesReserve * noReserve;
              const newYesReserve = yesReserve + event.tokenAmount;
              const newNoReserve = k / newYesReserve;
              const noFreed = noReserve - newNoReserve;
              yesReserve = newYesReserve - noFreed;
              noReserve = newNoReserve;
              totalCollateral -= noFreed;
            } else {
              const k = yesReserve * noReserve;
              const newNoReserve = noReserve + event.tokenAmount;
              const newYesReserve = k / newNoReserve;
              const yesFreed = yesReserve - newYesReserve;
              yesReserve = newYesReserve;
              noReserve = newNoReserve - yesFreed;
              totalCollateral -= yesFreed;
            }
          }
        } else if (event.kind === "liquidity") {
          if (event.type === "add") {
            // PredictionMarket.sol lines 254–266
            const yesToMint =
              (event.collateralAmount * yesReserve) / totalCollateral;
            const noToMint =
              (event.collateralAmount * noReserve) / totalCollateral;
            yesReserve += yesToMint;
            noReserve += noToMint;
            totalCollateral += event.collateralAmount;
            totalLpShares += event.shareAmount;
          } else {
            // PredictionMarket.sol lines 275–299
            const yesAmount =
              (event.shareAmount * yesReserve) / totalLpShares;
            const noAmount =
              (event.shareAmount * noReserve) / totalLpShares;
            yesReserve -= yesAmount;
            noReserve -= noAmount;
            const matched = yesAmount < noAmount ? yesAmount : noAmount;
            totalCollateral -= matched;
            totalLpShares -= event.shareAmount;
          }
        }

        // Compute price: yesPrice = noReserve / total (the more NO tokens in reserve, the higher YES price)
        const total = yesReserve + noReserve;
        const yesPrice =
          total > 0n ? Number((noReserve * 10000n) / total) / 100 : 50;

        points.push({
          timestamp: 0,
          yesPrice,
          blockNumber: event.blockNumber,
        });
      }

      // Enrich with timestamps
      const timestamps = await enrichWithTimestamps(
        points.map((p) => p.blockNumber)
      );
      for (const point of points) {
        point.timestamp = timestamps.get(point.blockNumber) ?? 0;
      }

      return points;
    },
  });
}
