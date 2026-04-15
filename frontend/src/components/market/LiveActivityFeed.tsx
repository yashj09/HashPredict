"use client";

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { formatUSDT, shortenAddress, cn, explorerTxUrl, explorerAddressUrl } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  user: `0x${string}`;
  type: "buy" | "sell";
  side: string; // "YES" | "NO" | "UP" | "DOWN"
  amount: bigint;
  txHash: `0x${string}`;
  timestamp: number;
}

export function LiveActivityFeed({
  items,
  isLoading,
  sideColors = { positive: "text-emerald-400", negative: "text-red-400" },
  positiveSides = ["YES", "UP"],
}: {
  items: ActivityItem[];
  isLoading: boolean;
  sideColors?: { positive: string; negative: string };
  positiveSides?: string[];
}) {
  const [prevCount, setPrevCount] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // Detect new items and flash them
  useEffect(() => {
    if (items.length > prevCount && prevCount > 0) {
      const fresh = new Set(
        items.slice(0, items.length - prevCount).map((i) => i.id),
      );
      setNewIds(fresh);
      // Clear flash after animation
      const timer = setTimeout(() => setNewIds(new Set()), 2000);
      return () => clearTimeout(timer);
    }
    setPrevCount(items.length);
  }, [items.length]);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <h3 className="text-sm font-semibold text-white">Live Activity</h3>
        </div>
        <span className="text-[10px] text-slate-600">
          {items.length} trade{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Feed */}
      <div ref={listRef} className="max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-slate-800/20">
                <div className="skeleton h-4 w-3/4 mb-1.5" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-slate-500 text-sm">No trades yet</p>
            <p className="text-slate-600 text-xs mt-1">Be the first to trade!</p>
          </div>
        ) : (
          items.map((item) => {
            const isPositive = positiveSides.includes(item.side);
            const isNew = newIds.has(item.id);

            return (
              <div
                key={item.id}
                className={cn(
                  "px-4 py-2.5 border-b border-slate-800/15 transition-colors duration-500",
                  isNew && "bg-teal-500/5",
                )}
              >
                {/* Main row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Action icon */}
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                        item.type === "buy"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400",
                      )}
                    >
                      {item.type === "buy" ? (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 2L8 7H2L5 2Z" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 8L2 3H8L5 8Z" fill="currentColor" />
                        </svg>
                      )}
                    </div>

                    {/* User + action */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={explorerAddressUrl(item.user)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-slate-300 hover:text-teal-400 transition-colors"
                        >
                          {shortenAddress(item.user)}
                        </a>
                        <span className="text-[10px] text-slate-500">
                          {item.type === "buy" ? "bought" : "sold"}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            isPositive ? sideColors.positive : sideColors.negative,
                          )}
                        >
                          {item.side}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600">
                        {item.timestamp > 0
                          ? formatDistanceToNow(item.timestamp * 1000, { addSuffix: true })
                          : "just now"}
                      </p>
                    </div>
                  </div>

                  {/* Amount + tx */}
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono font-medium text-white">
                      ${formatUSDT(item.amount)}
                    </p>
                    <a
                      href={explorerTxUrl(item.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-600 hover:text-teal-400 transition-colors"
                    >
                      {item.txHash.slice(0, 6)}...
                    </a>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
