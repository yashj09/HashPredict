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

type ViewMode = "grid" | "list";

const ENDED_INITIAL_SHOW = 3;

export function MarketGrid() {
  const { markets, isLoading, error } = useMarkets();
  const { activeMarkets: speedActive, resolvedMarkets: speedResolved, isLoading: speedLoading } = useSpeedMarkets();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [sortBy, setSortBy] = useState<Sort>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewMode>("grid");
  const [endedView, setEndedView] = useState<ViewMode>("grid");
  const [showAllEnded, setShowAllEnded] = useState(false);

  // Split speed markets into active vs expired
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

  // Ended markets: combine speed resolved + regular ended
  const allEndedSpeed = filteredSpeedResolved;
  const allEndedRegular = endedRegular;
  const totalEnded = allEndedSpeed.length + allEndedRegular.length;
  const hasEndedContent = totalEnded > 0;

  // Limit ended to ENDED_INITIAL_SHOW unless expanded
  const visibleEndedSpeed = showAllEnded ? allEndedSpeed : allEndedSpeed.slice(0, ENDED_INITIAL_SHOW);
  const remainingSlots = Math.max(0, ENDED_INITIAL_SHOW - visibleEndedSpeed.length);
  const visibleEndedRegular = showAllEnded ? allEndedRegular : allEndedRegular.slice(0, remainingSlots);
  const visibleEndedTotal = visibleEndedSpeed.length + visibleEndedRegular.length;
  const hasMoreEnded = totalEnded > ENDED_INITIAL_SHOW && !showAllEnded;

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
        <div className="space-y-10">
          {/* ── Active Markets Section ── */}
          {hasActiveContent && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">Active Markets</h2>
                  <span className="text-sm text-slate-500">
                    ({filteredSpeedActive.length + activeRegular.length})
                  </span>
                </div>
                <ViewToggle view={activeView} onChange={setActiveView} />
              </div>

              {activeView === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSpeedActive.map((market) => (
                    <SpeedMarketCard key={`speed-${market.marketId}`} market={market} />
                  ))}
                  {activeRegular.map((market) => (
                    <MarketCard key={market.address} market={market} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSpeedActive.map((market) => (
                    <SpeedMarketCard key={`speed-${market.marketId}`} market={market} />
                  ))}
                  {activeRegular.map((market) => (
                    <MarketCard key={market.address} market={market} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Ended & Resolved Section ── */}
          {hasEndedContent && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-400">Ended & Resolved</h2>
                  <span className="text-sm text-slate-600">
                    ({totalEnded})
                  </span>
                </div>
                <ViewToggle view={endedView} onChange={setEndedView} />
              </div>

              {endedView === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleEndedSpeed.map((market) => (
                    <SpeedMarketCard key={`speed-resolved-${market.marketId}`} market={market} />
                  ))}
                  {visibleEndedRegular.map((market) => (
                    <MarketCard key={market.address} market={market} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleEndedSpeed.map((market) => (
                    <SpeedMarketCard key={`speed-resolved-${market.marketId}`} market={market} />
                  ))}
                  {visibleEndedRegular.map((market) => (
                    <MarketCard key={market.address} market={market} />
                  ))}
                </div>
              )}

              {/* Show More */}
              {hasMoreEnded && (
                <button
                  onClick={() => setShowAllEnded(true)}
                  className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-teal-300 border border-slate-700/30 hover:border-teal-500/30 transition-colors"
                >
                  Show {totalEnded - visibleEndedTotal} more ended markets
                </button>
              )}
              {showAllEnded && totalEnded > ENDED_INITIAL_SHOW && (
                <button
                  onClick={() => setShowAllEnded(false)}
                  className="mt-4 w-full py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Grid/List Toggle ── */

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5">
      <button
        onClick={() => onChange("grid")}
        className={cn(
          "p-1.5 rounded-md transition-colors",
          view === "grid" ? "bg-teal-500/15 text-teal-300" : "text-slate-500 hover:text-slate-300",
        )}
        title="Grid view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <button
        onClick={() => onChange("list")}
        className={cn(
          "p-1.5 rounded-md transition-colors",
          view === "list" ? "bg-teal-500/15 text-teal-300" : "text-slate-500 hover:text-slate-300",
        )}
        title="List view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="7" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="12" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}
