"use client";

import { useState } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCard } from "./MarketCard";
import { cn } from "@/lib/utils";

const filters = ["All", "Crypto", "RWA", "Active", "Resolved"] as const;
type Filter = (typeof filters)[number];

export function MarketGrid() {
  const { markets, isLoading, error } = useMarkets();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const filtered = markets.filter((m) => {
    switch (activeFilter) {
      case "Crypto":
        return m.category === "Crypto";
      case "RWA":
        return m.category === "RWA";
      case "Active":
        return !m.resolved && Number(m.endTimestamp) * 1000 > Date.now();
      case "Resolved":
        return m.resolved;
      default:
        return true;
    }
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Failed to load markets. Make sure you&apos;re connected to HashKey Chain Testnet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
              activeFilter === f
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 h-48 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-500">No markets found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((market) => (
            <MarketCard key={market.address} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}
