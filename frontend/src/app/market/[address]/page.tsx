"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useMarket } from "@/hooks/useMarket";
import { useMarketTradeHistory } from "@/hooks/useMarketHistory";
import { MarketInfo } from "@/components/market/MarketInfo";
import { TradingPanel } from "@/components/market/TradingPanel";
import { ClaimPanel } from "@/components/market/ClaimPanel";
import { PriceChart } from "@/components/market/PriceChart";
import { TradeHistory } from "@/components/market/TradeHistory";
import { LiveActivityFeed, type ActivityItem } from "@/components/market/LiveActivityFeed";
import { OracleResolution } from "@/components/market/OracleResolution";

export default function MarketPage() {
  const params = useParams();
  const address = params.address as `0x${string}`;
  const queryClient = useQueryClient();
  const { market, isLoading, refetch } = useMarket(address);
  const { data: trades, isLoading: tradesLoading } = useMarketTradeHistory(address);

  const activityItems: ActivityItem[] = (trades ?? []).map((t, i) => ({
    id: `${t.txHash}-${i}`,
    user: t.user,
    type: t.type,
    side: t.side,
    amount: t.collateralAmount,
    txHash: t.txHash,
    timestamp: t.timestamp,
  }));

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 skeleton w-3/4" />
          <div className="h-48 skeleton" />
          <div className="h-64 skeleton" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Market not found</h2>
        <p className="text-slate-400 mb-6">This market doesn&apos;t exist or couldn&apos;t be loaded.</p>
        <Link href="/" className="text-teal-400 hover:text-teal-300">
          Back to markets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:text-teal-300 mb-6 inline-block">
        &larr; Back to markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Market info + chart + trade history */}
        <div className="lg:col-span-2 space-y-6">
          <MarketInfo market={market} />
          <PriceChart marketAddress={address} />
          <TradeHistory marketAddress={address} />
        </div>

        {/* Right: Trading panel + Live Activity + Oracle */}
        <div className="space-y-4">
          {market.resolved ? (
            <ClaimPanel market={market} />
          ) : (
            <TradingPanel market={market} onTradeComplete={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ["marketTrades", address] });
            }} />
          )}
          <LiveActivityFeed
            items={activityItems}
            isLoading={tradesLoading}
            positiveSides={["YES"]}
          />
          <OracleResolution
            marketAddress={address}
            resolved={market.resolved}
            endTimestamp={market.endTimestamp}
            onResolved={refetch}
          />
        </div>
      </div>
    </div>
  );
}
