import express from "express";
import { formatUnits } from "viem";
import { publicClient, account } from "../clients.js";
import { collateralAbi } from "../abi.js";
import { COLLATERAL_ADDRESS, HEALTH_PORT } from "../config.js";
import { getPendingSlots } from "../jobs/resolveSlots.js";

interface HealthState {
  lastSlotCreated: number | null;
  lastSlotResolved: number | null;
  slotsCreatedTotal: number;
  slotsResolvedTotal: number;
}

export const healthState: HealthState = {
  lastSlotCreated: null,
  lastSlotResolved: null,
  slotsCreatedTotal: 0,
  slotsResolvedTotal: 0,
};

export function startHealthServer() {
  const app = express();

  app.get("/health", async (_req, res) => {
    try {
      const usdtBalance = await publicClient.readContract({
        address: COLLATERAL_ADDRESS,
        abi: collateralAbi,
        functionName: "balanceOf",
        args: [account.address],
      });

      res.json({
        status: "ok",
        keeper: account.address,
        usdtBalance: formatUnits(usdtBalance, 6),
        ...healthState,
        pendingSlots: getPendingSlots(),
        uptime: process.uptime(),
      });
    } catch (err) {
      res.status(500).json({
        status: "error",
        error: String(err),
      });
    }
  });

  app.listen(HEALTH_PORT, () => {
    console.log(`[Health] Listening on port ${HEALTH_PORT}`);
  });
}
