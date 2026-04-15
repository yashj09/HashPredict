"use client";

import { useState, useMemo } from "react";
import { useMarkets, type MarketData } from "@/hooks/useMarkets";
import { useSpeedMarkets, type SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { MarketCard } from "./MarketCard";
import { SpeedMarketCard } from "@/components/speed/SpeedMarketCard";
import { cn } from "@/lib/utils";

const filters = ["All", "Speed", "Crypto", "RWA"] as const;
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
  const { activeMarkets: speedActive, resolvedMarkets: speedResolved, isLoading: speedLoading } = useSpeedMarkets();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [sortBy, setSortBy] = useState<Sort>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Split speed markets into active vs expired
  const now = Math.floor(Date.now() / 1000);
  const filteredSpeedActive = useMemo(() => {
    if (activeFilter !== "All" && activeFilter !== "Speed") return [];
    let list = speedActive;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.asset.toLowerCase().includes(q) || "speed".includes(q));
    }
    return list;
  }, [speedActive, activeFilter, searchQuery]);

  const filteredSpeedResolved = useMemo(() => {
    if (activeFilter !== "All" && activeFilter !== "Speed") return [];
    let list = speedResolved;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.asset.toLowerCase().includes(q) || "speed".includes(q));
    }
    return list;
  }, [speedResolved, activeFilter, searchQuery]);

  // Split regular markets into active vs ended/resolved
  const { activeRegular, endedRegular } = useMemo(() => {
    if (activeFilter === "Speed") return { activeRegular: [] as MarketData[], endedRegular: [] as MarketData[] };

    const base = markets
      .filter((m) => {
        switch (activeFilter) {
          case "Crypto": return m.category === "Crypto";
          case "RWA": return m.category === "RWA";
          default: return true;
        }
      })
      .filter(
        (m) =>
          searchQuery === "" ||
          m.question.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const sortFn = (a: MarketData, b: MarketData) => {
      switch (sortBy) {
        case "newest": return Number(b.endTimestamp - a.endTimestamp);
        case "endingSoon": return Number(a.endTimestamp - b.endTimestamp);
        case "volume": return Number(b.totalVolume - a.totalVolume);
        case "liquidity": return Number(b.totalCollateral - a.totalCollateral);
      }
    };

    const active = base
      .filter((m) => !m.resolved && Number(m.endTimestamp) * 1000 > Date.now())
      .sort(sortFn);

    const ended = base
      .filter((m) => m.resolved || Number(m.endTimestamp) * 1000 <= Date.now())
      .sort(sortFn);

    return { activeRegular: active, endedRegular: ended };
  }, [markets, activeFilter, searchQuery, sortBy]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Failed to load markets. Make sure you&apos;re connected to HashKey Chain Testnet.</p>
      </div>
    );
  }

  const allLoading = isLoading || speedLoading;
  const hasActiveContent = filteredSpeedActive.length > 0 || activeRegular.length > 0;
  const hasEndedContent = filteredSpeedResolved.length > 0 || endedRegular.length > 0;
  const totalResults = filteredSpeedActive.length + filteredSpeedResolved.length + activeRegular.length + endedRegular.length;

  return (
    <div>
      {/* Search */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
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
          className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
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
                  ? f === "Speed"
                    ? "bg-amber-600 text-white"
                    : "bg-teal-600 text-white"
                  : "bg-slate-800/40 border border-slate-700/30 text-slate-400 hover:text-slate-200 hover:bg-slate-700/40",
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
                  ? "bg-teal-500/15 text-teal-300"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30",
              )}
            >
              {sortLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {allLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-48" />
          ))}
        </div>
      ) : totalResults === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No markets found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Markets Section */}
          {hasActiveContent && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-white">Active Markets</h2>
                <span className="text-sm text-slate-500">
                  ({filteredSpeedActive.length + activeRegular.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSpeedActive.map((market) => (
                  <SpeedMarketCard key={`speed-${market.marketId}`} market={market} />
                ))}
                {activeRegular.map((market) => (
                  <MarketCard key={market.address} market={market} />
                ))}
              </div>
            </div>
          )}

          {/* Ended / Resolved Markets Section */}
          {hasEndedContent && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-slate-400">Ended & Resolved</h2>
                <span className="text-sm text-slate-600">
                  ({filteredSpeedResolved.length + endedRegular.length})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSpeedResolved.map((market) => (
                  <SpeedMarketCard key={`speed-resolved-${market.marketId}`} market={market} />
                ))}
                {endedRegular.map((market) => (
                  <MarketCard key={market.address} market={market} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
