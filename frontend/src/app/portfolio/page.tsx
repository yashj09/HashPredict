"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useGaslessClaim } from "@/hooks/useGaslessTrade";
import { useEmbeddedWallet } from "@/hooks/useEmbeddedWallet";
import { MARKET_ABI } from "@/lib/contracts";
import { formatUSDT, cn } from "@/lib/utils";
import { PositionPnL } from "@/components/portfolio/PositionPnL";

function ClaimButton({
  marketAddress,
  resolved,
  userAddress,
  onClaimed,
}: {
  marketAddress: `0x${string}`;
  resolved: boolean;
  userAddress: `0x${string}`;
  onClaimed?: () => void;
}) {
  const { claim, isLoading } = useGaslessClaim(marketAddress);
  const { data: hasClaimed } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "claimed",
    args: [userAddress],
    query: { enabled: resolved },
  });

  if (!resolved || hasClaimed) return null;

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        await claim();
        onClaimed?.();
      }}
      disabled={isLoading}
      className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
    >
      {isLoading ? "Claiming..." : "Claim"}
    </button>
  );
}

export default function PortfolioPage() {
  const { address: userAddress } = useAccount();
  const { wallet } = useEmbeddedWallet();
  const { positions, isLoading, refetch } = usePortfolio();
  const portfolioAddress = wallet?.address ?? userAddress;

  if (!userAddress) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Portfolio</h1>
        <p className="text-zinc-400">Connect your wallet to view your positions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">Your Portfolio</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-4">No positions yet.</p>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Browse markets to start trading
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos) => {
            const totalReserve = pos.market.yesReserve + pos.market.noReserve;
            const yesPercent =
              totalReserve > 0n
                ? Number((pos.market.noReserve * 10000n) / totalReserve) / 100
                : 50;

            return (
              <Link key={pos.market.address} href={`/market/${pos.market.address}`}>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {pos.market.category}
                      </span>
                      {pos.market.resolved && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{pos.market.question}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Prob: {yesPercent.toFixed(1)}% YES | Vol: ${formatUSDT(pos.market.totalVolume)}
                    </p>
                    {!pos.market.resolved && portfolioAddress && (
                      <PositionPnL
                        marketAddress={pos.market.address}
                        userAddress={portfolioAddress}
                        yesBalance={pos.yesBalance}
                        noBalance={pos.noBalance}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right text-xs">
                      {pos.yesBalance > 0n && (
                        <p className="text-emerald-400">
                          YES: {parseFloat(formatUnits(pos.yesBalance, 6)).toFixed(2)}
                        </p>
                      )}
                      {pos.noBalance > 0n && (
                        <p className="text-red-400">
                          NO: {parseFloat(formatUnits(pos.noBalance, 6)).toFixed(2)}
                        </p>
                      )}
                    </div>
                    {portfolioAddress && (
                      <ClaimButton
                        marketAddress={pos.market.address}
                        resolved={pos.market.resolved}
                        userAddress={portfolioAddress}
                        onClaimed={refetch}
                      />
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
