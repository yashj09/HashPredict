"use client";

import { useState } from "react";
import { useSpeedMarkets } from "@/hooks/useSpeedMarkets";
import { SpeedMarketCard } from "@/components/speed/SpeedMarketCard";
import { cn } from "@/lib/utils";

const ASSETS = ["ALL", "BTC", "ETH", "SOL"];

export default function SpeedMarketsPage() {
  const { activeMarkets, resolvedMarkets, isLoading, error } = useSpeedMarkets();
  const [filter, setFilter] = useState("ALL");

  const filteredActive =
    filter === "ALL"
      ? activeMarkets
      : activeMarkets.filter((m) => m.asset === filter);

  const filteredResolved =
    filter === "ALL"
      ? resolvedMarkets
      : resolvedMarkets.filter((m) => m.asset === filter);

  return (
    <div>
      {/* Header */}
      <section className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Speed Markets
            </h1>
            <p className="mt-3 text-zinc-400 leading-relaxed">
              15-minute binary markets on crypto prices. Predict whether the price
              goes UP or DOWN from the strike price. New markets created automatically
              every 15 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Asset filter tabs */}
        <div className="flex gap-2 mb-6">
          {ASSETS.map((asset) => (
            <button
              key={asset}
              onClick={() => setFilter(asset)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                filter === asset
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200",
              )}
            >
              {asset}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-20 text-zinc-500">
            Loading speed markets...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-20 text-red-400">
            Failed to load speed markets. Make sure the SpeedMarketAMM contract is deployed.
          </div>
        )}

        {/* Active markets */}
        {!isLoading && !error && (
          <>
            <h2 className="text-lg font-semibold text-white mb-4">
              Active Markets
              {filteredActive.length > 0 && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  ({filteredActive.length})
                </span>
              )}
            </h2>

            {filteredActive.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl mb-8">
                No active speed markets. The keeper bot creates new markets every 15 minutes.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {filteredActive.map((market) => (
                  <SpeedMarketCard key={market.marketId.toString()} market={market} />
                ))}
              </div>
            )}

            {/* Recent results */}
            {filteredResolved.length > 0 && (
              <>
                <h2 className="text-lg font-semibold text-white mb-4">
                  Recent Results
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({filteredResolved.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredResolved.map((market) => (
                    <SpeedMarketCard key={market.marketId.toString()} market={market} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
