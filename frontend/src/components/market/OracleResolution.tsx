"use client";

import { useOracleConfig, useResolveWithOracle } from "@/hooks/useSupraResolver";
import { formatUnits } from "viem";

export function OracleResolution({
  marketAddress,
  resolved,
  endTimestamp,
  onResolved,
}: {
  marketAddress: `0x${string}`;
  resolved: boolean;
  endTimestamp: bigint;
  onResolved?: () => void;
}) {
  const { config, isLoading: configLoading } = useOracleConfig(marketAddress);
  const { resolve: resolveOracle, isLoading: resolving } = useResolveWithOracle(marketAddress);

  if (configLoading || !config) return null;

  const now = Math.floor(Date.now() / 1000);
  const marketEnded = now >= Number(endTimestamp);

  // Derive a human-readable target description
  const targetDisplay = formatOracleTarget(
    config.pairLabel,
    config.targetPrice,
    config.resolveYesIfAbove
  );

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <h4 className="text-sm font-medium text-amber-300">
          Oracle Resolution
        </h4>
      </div>

      <p className="text-xs text-slate-400 mb-1">SUPRA Oracle Price Feed</p>
      <p className="text-sm text-white font-medium mb-3">
        {targetDisplay}
      </p>

      {resolved ? (
        <p className="text-xs text-slate-500">Market already resolved.</p>
      ) : !marketEnded ? (
        <p className="text-xs text-slate-500">
          Oracle resolution available after market ends.
        </p>
      ) : (
        <button
          onClick={async () => { await resolveOracle(); onResolved?.(); }}
          disabled={resolving}
          className="w-full py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
        >
          {resolving ? "Resolving..." : "Resolve via Oracle"}
        </button>
      )}

      <p className="text-xs text-slate-600 mt-2">
        Anyone can trigger resolution once the market has ended.
      </p>
    </div>
  );
}

function formatOracleTarget(
  pairLabel: string,
  targetPrice: bigint,
  resolveYesIfAbove: boolean
): string {
  // SUPRA prices come with 18 decimals typically
  const priceFloat = parseFloat(formatUnits(targetPrice, 18));
  const formatted = priceFloat.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  const op = resolveYesIfAbove ? "\u2265" : "<";
  return `${pairLabel} ${op} $${formatted}`;
}
