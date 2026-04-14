"use client";

import { useSpeedTradeHistory } from "@/hooks/useSpeedTradeHistory";
import { formatUSDT, shortenAddress, cn, explorerTxUrl, explorerAddressUrl } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function SpeedTradeHistory({ marketId }: { marketId: bigint }) {
  const { data: trades, isLoading, isError } = useSpeedTradeHistory(marketId);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Trade History</h3>

      {isError ? (
        <p className="text-zinc-500 text-sm text-center py-6">Failed to load trade history.</p>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      ) : !trades || trades.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-6">No trades yet.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-900/90 backdrop-blur">
              <tr className="text-zinc-500 text-xs uppercase">
                <th className="text-left py-2 pr-2 font-medium">Time</th>
                <th className="text-left py-2 pr-2 font-medium">User</th>
                <th className="text-left py-2 pr-2 font-medium">Type</th>
                <th className="text-left py-2 pr-2 font-medium">Side</th>
                <th className="text-right py-2 pr-2 font-medium">Amount</th>
                <th className="text-right py-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {trades.map((trade, i) => (
                <tr key={`${trade.txHash}-${i}`} className="text-zinc-300">
                  <td className="py-2 pr-2 text-zinc-500 whitespace-nowrap">
                    {trade.timestamp > 0
                      ? formatDistanceToNow(trade.timestamp * 1000, { addSuffix: true })
                      : "--"}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">
                    <a
                      href={explorerAddressUrl(trade.user)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-indigo-400 transition-colors"
                    >
                      {shortenAddress(trade.user)}
                    </a>
                  </td>
                  <td className="py-2 pr-2">
                    <span className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      trade.type === "buy"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400",
                    )}>
                      {trade.type === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <span className={cn(
                      "text-xs font-medium",
                      trade.side === "UP" ? "text-emerald-400" : "text-red-400",
                    )}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-xs">
                    ${formatUSDT(trade.collateralAmount)}
                  </td>
                  <td className="py-2 text-right">
                    <a
                      href={explorerTxUrl(trade.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-zinc-600 hover:text-indigo-400 transition-colors"
                    >
                      {trade.txHash.slice(0, 6)}...
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
