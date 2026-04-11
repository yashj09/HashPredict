"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMarket } from "@/hooks/useMarket";
import { MarketInfo } from "@/components/market/MarketInfo";
import { TradingPanel } from "@/components/market/TradingPanel";
import { ClaimPanel } from "@/components/market/ClaimPanel";

export default function MarketPage() {
  const params = useParams();
  const address = params.address as `0x${string}`;
  const { market, isLoading, refetch } = useMarket(address);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-3/4" />
          <div className="h-48 bg-zinc-800 rounded-xl" />
          <div className="h-64 bg-zinc-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Market not found</h2>
        <p className="text-zinc-400 mb-6">This market doesn&apos;t exist or couldn&apos;t be loaded.</p>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300">
          Back to markets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        &larr; Back to markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Market info */}
        <div className="lg:col-span-2">
          <MarketInfo market={market} />
        </div>

        {/* Right: Trading panel */}
        <div className="space-y-4">
          {market.resolved ? (
            <ClaimPanel market={market} />
          ) : (
            <TradingPanel market={market} onTradeComplete={refetch} />
          )}
        </div>
      </div>
    </div>
  );
}
