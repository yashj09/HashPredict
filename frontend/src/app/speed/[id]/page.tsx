"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { SPEED_MARKET_ADDRESS, SPEED_MARKET_ABI } from "@/lib/contracts";
import type { SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { SpeedMarketInfo } from "@/components/speed/SpeedMarketInfo";
import { SpeedPriceChart } from "@/components/speed/SpeedPriceChart";
import { SpeedTradeHistory } from "@/components/speed/SpeedTradeHistory";
import { SpeedTradingPanel } from "@/components/speed/SpeedTradingPanel";

export default function SpeedMarketDetailPage() {
  const params = useParams();
  const marketId = BigInt(params.id as string);

  const { data: raw, isLoading, refetch } = useReadContract({
    address: SPEED_MARKET_ADDRESS,
    abi: SPEED_MARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
    query: { refetchInterval: 10_000 },
  });

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

  if (!raw) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Speed market not found</h2>
        <p className="text-zinc-400 mb-6">This market doesn&apos;t exist or couldn&apos;t be loaded.</p>
        <Link href="/speed" className="text-indigo-400 hover:text-indigo-300">
          Back to speed markets
        </Link>
      </div>
    );
  }

  const r = raw as [string, bigint, bigint, boolean, boolean, bigint, bigint, bigint, bigint];
  const market: SpeedMarketData = {
    marketId,
    asset: r[0],
    strikePrice: r[1],
    expiry: Number(r[2]),
    resolved: r[3],
    outcomeIsUp: r[4],
    reserveUp: r[5],
    reserveDown: r[6],
    totalCollateral: r[7],
    totalLpShares: r[8],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/speed" className="text-sm text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        &larr; Back to speed markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info + Chart + Trade history */}
        <div className="lg:col-span-2 space-y-6">
          <SpeedMarketInfo market={market} />
          <SpeedPriceChart asset={market.asset} strikePrice={market.strikePrice} />
          <SpeedTradeHistory marketId={marketId} />
        </div>

        {/* Right: Trading panel */}
        <div className="space-y-4">
          <SpeedTradingPanel market={market} onTradeComplete={refetch} />
        </div>
      </div>
    </div>
  );
}
