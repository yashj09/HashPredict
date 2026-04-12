"use client";

import { useState, useMemo } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCard } from "./MarketCard";
import { cn } from "@/lib/utils";

const filters = ["All", "Crypto", "RWA", "Active", "Resolved"] as const;
type Filter = (typeof filters)[number];

const sorts = ["newest", "endingSoon", "volume", "liquidity"] as const;
type Sort = (typeof sorts)[number];

const sortLabels: Record<Sort, string> = {
  newest: "Newest",
  endingSoon: "Ending Soon",
  volume: "Top Volume",
  liquidity: "Top Liquidity",
};

export function MarketGrid() {
  const { markets, isLoading, error } = useMarkets();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [sortBy, setSortBy] = useState<Sort>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return markets
      .filter((m) => {
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
      })
      .filter(
        (m) =>
          searchQuery === "" ||
          m.question.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return Number(b.endTimestamp - a.endTimestamp);
          case "endingSoon":
            return Number(a.endTimestamp - b.endTimestamp);
          case "volume":
            return Number(b.totalVolume - a.totalVolume);
          case "liquidity":
            return Number(b.totalCollateral - a.totalCollateral);
        }
      });
  }, [markets, activeFilter, searchQuery, sortBy]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Failed to load markets. Make sure you&apos;re connected to HashKey Chain Testnet.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search markets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Filters + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sorts.map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                sortBy === s
                  ? "bg-zinc-700 text-zinc-100"
                  : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              )}
            >
              {sortLabels[s]}
            </button>
          ))}
        </div>
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
