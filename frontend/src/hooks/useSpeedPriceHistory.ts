"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchAllSpeedMarketEvents,
  enrichWithTimestamps,
} from "@/lib/speedEvents";

export interface SpeedPricePoint {
  timestamp: number;
  upPrice: number; // 0–100 percentage
  blockNumber: bigint;
}

const FEE_BPS = 200n;
const BPS = 10_000n;

/**
 * Reconstructs UP probability history by replaying all speed market events
 * against the CPMM math from SpeedMarketAMM.sol.
 */
export function useSpeedPriceHistory(marketId: bigint, initialLiquidity: bigint) {
  return useQuery<SpeedPricePoint[]>({
    queryKey: ["speedPriceHistory", marketId.toString()],
    staleTime: 15_000,
    retry: 1,
    queryFn: async () => {
      const events = await fetchAllSpeedMarketEvents(marketId);

      let reserveUp = initialLiquidity;
      let reserveDown = initialLiquidity;
      let totalCollateral = initialLiquidity;
      let totalLpShares = initialLiquidity;

      const points: SpeedPricePoint[] = [];

      // Starting point: 50/50
      const firstBlock = events.length > 0 ? events[0].blockNumber : 0n;
      points.push({
        timestamp: 0,
        upPrice: 50,
        blockNumber: firstBlock > 0n ? firstBlock - 1n : 0n,
      });

      for (const event of events) {
        if (event.kind === "trade") {
          if (event.type === "buy") {
            const fee = (event.collateralAmount * FEE_BPS) / BPS;
            const effective = event.collateralAmount - fee;

            if (event.isUp) {
              // Buying UP: collateral goes to DOWN reserve
              const k = reserveUp * reserveDown;
              const newDown = reserveDown + effective;
              const newUp = k / newDown;
              reserveUp = newUp;
              reserveDown = newDown;
            } else {
              // Buying DOWN: collateral goes to UP reserve
              const k = reserveUp * reserveDown;
              const newUp = reserveUp + effective;
              const newDown = k / newUp;
              reserveUp = newUp;
              reserveDown = newDown;
            }
            totalCollateral += effective;
          } else {
            // Sell
            if (event.isUp) {
              const k = reserveUp * reserveDown;
              const newUp = reserveUp + event.tokenAmount;
              const newDown = k / newUp;
              const downFreed = reserveDown - newDown;
              reserveUp = newUp - downFreed;
              reserveDown = newDown;
              totalCollateral -= downFreed;
            } else {
              const k = reserveUp * reserveDown;
              const newDown = reserveDown + event.tokenAmount;
              const newUp = k / newDown;
              const upFreed = reserveUp - newUp;
              reserveUp = newUp;
              reserveDown = newDown - upFreed;
              totalCollateral -= upFreed;
            }
          }
        } else if (event.kind === "liquidity") {
          if (event.type === "add") {
            const upToMint = (event.collateralAmount * reserveUp) / totalCollateral;
            const downToMint = (event.collateralAmount * reserveDown) / totalCollateral;
            reserveUp += upToMint;
            reserveDown += downToMint;
            totalCollateral += event.collateralAmount;
            totalLpShares += event.shareAmount;
          } else {
            const upAmount = (event.shareAmount * reserveUp) / totalLpShares;
            const downAmount = (event.shareAmount * reserveDown) / totalLpShares;
            reserveUp -= upAmount;
            reserveDown -= downAmount;
            const matched = upAmount < downAmount ? upAmount : downAmount;
            totalCollateral -= matched;
            totalLpShares -= event.shareAmount;
          }
        }

        // upPrice = reserveDown / (reserveUp + reserveDown)
        // (more DOWN tokens in reserve = UP is more expensive = higher UP probability)
        const total = reserveUp + reserveDown;
        const upPrice = total > 0n ? Number((reserveDown * 10000n) / total) / 100 : 50;

        points.push({
          timestamp: 0,
          upPrice,
          blockNumber: event.blockNumber,
        });
      }

      // Enrich with timestamps
      const timestamps = await enrichWithTimestamps(
        points.map((p) => p.blockNumber),
      );
      for (const point of points) {
        point.timestamp = timestamps.get(point.blockNumber) ?? 0;
      }

      return points;
    },
  });
}
