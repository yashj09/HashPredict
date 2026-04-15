"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useSpeedPortfolio } from "@/hooks/useSpeedPortfolio";
import { useGaslessClaim } from "@/hooks/useGaslessTrade";
import { useSpeedClaim } from "@/hooks/useSpeedTrade";
import { useGaslessSpeedClaim } from "@/hooks/useGaslessSpeedTrade";
import { useEmbeddedWallet } from "@/hooks/useEmbeddedWallet";
import { MARKET_ABI, SPEED_MARKET_ADDRESS, SPEED_MARKET_ABI } from "@/lib/contracts";
import { getEmbeddedWallet } from "@/lib/embeddedWallet";
import { formatUSDT, cn } from "@/lib/utils";

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
  const [justClaimed, setJustClaimed] = useState(false);
  const { data: hasClaimed } = useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: "claimed",
    args: [userAddress],
    query: { enabled: resolved, refetchInterval: 5_000 },
  });

  if (!resolved || hasClaimed || justClaimed) return null;

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        await claim();
        setJustClaimed(true);
        onClaimed?.();
      }}
      disabled={isLoading}
      className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
    >
      {isLoading ? "Claiming..." : "Claim"}
    </button>
  );
}

function SpeedClaimButton({
  marketId,
  resolved,
  outcomeIsUp,
  upBalance,
  downBalance,
  onClaimed,
}: {
  marketId: bigint;
  resolved: boolean;
  outcomeIsUp: boolean;
  upBalance: bigint;
  downBalance: bigint;
  onClaimed?: () => void;
}) {
  const { claim, isLoading } = useSpeedClaim();
  const { claim: gaslessClaim, isLoading: gaslessLoading } = useGaslessSpeedClaim();
  const { wallet } = useEmbeddedWallet();
  const [justClaimed, setJustClaimed] = useState(false);

  // Check if already claimed on-chain — use same address as portfolio query
  const { address: mainAddress } = useAccount();
  const embeddedWallet = typeof window !== "undefined" ? getEmbeddedWallet() : null;
  const claimAddress = (embeddedWallet?.address ?? mainAddress) as `0x${string}` | undefined;
  const { data: hasClaimed } = useReadContract({
    address: SPEED_MARKET_ADDRESS,
    abi: SPEED_MARKET_ABI,
    functionName: "claimed",
    args: claimAddress ? [marketId, claimAddress] : undefined,
    query: { enabled: resolved && !!claimAddress, refetchInterval: 5_000 },
  });

  const hasWinnings =
    resolved && ((outcomeIsUp && upBalance > 0n) || (!outcomeIsUp && downBalance > 0n));

  if (!resolved || !hasWinnings || hasClaimed || justClaimed) return null;

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        if (wallet) {
          await gaslessClaim(marketId);
        } else {
          await claim(marketId);
        }
        setJustClaimed(true);
        onClaimed?.();
      }}
      disabled={isLoading || gaslessLoading}
      className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
    >
      {isLoading || gaslessLoading ? "Claiming..." : "Claim"}
    </button>
  );
}

function formatStrikePrice(strikePrice: bigint): string {
  const price = Number(strikePrice) / 1e8;
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function PortfolioPage() {
  const { address: userAddress } = useAccount();
  const { wallet } = useEmbeddedWallet();
  const { positions, isLoading, refetch } = usePortfolio();
  const { positions: speedPositions, isLoading: speedLoading, refetch: refetchSpeed } = useSpeedPortfolio();
  const portfolioAddress = wallet?.address ?? userAddress;

  if (!userAddress) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Portfolio</h1>
        <p className="text-slate-400">Connect your wallet to view your positions.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">Your Portfolio</h1>

      {(isLoading || speedLoading) ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 skeleton" />
          ))}
        </div>
      ) : positions.length === 0 && speedPositions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">No positions yet.</p>
          <Link href="/" className="text-teal-400 hover:text-teal-300 text-sm">
            Browse markets to start trading
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Speed market positions */}
          {speedPositions.map((pos) => {
            const totalReserve = pos.market.reserveUp + pos.market.reserveDown;
            const upPercent =
              totalReserve > 0n
                ? Number((pos.market.reserveDown * 10000n) / totalReserve) / 100
                : 50;

            return (
              <Link key={`speed-${pos.market.marketId}`} href={`/speed/${pos.market.marketId.toString()}`}>
                <div className="glass-card p-4 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Speed
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {pos.market.asset}
                      </span>
                      {pos.market.resolved && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          pos.market.outcomeIsUp
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400",
                        )}>
                          {pos.market.outcomeIsUp ? "UP" : "DOWN"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {pos.market.asset} Speed Market — Strike ${formatStrikePrice(pos.market.strikePrice)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Prob: {upPercent.toFixed(1)}% UP | Liquidity: ${formatUSDT(pos.market.totalCollateral)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right text-xs">
                      {pos.upBalance > 0n && (
                        <p className="text-emerald-400">
                          UP: {parseFloat(formatUnits(pos.upBalance, 6)).toFixed(2)}
                        </p>
                      )}
                      {pos.downBalance > 0n && (
                        <p className="text-red-400">
                          DOWN: {parseFloat(formatUnits(pos.downBalance, 6)).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <SpeedClaimButton
                      marketId={pos.market.marketId}
                      resolved={pos.market.resolved}
                      outcomeIsUp={pos.market.outcomeIsUp}
                      upBalance={pos.upBalance}
                      downBalance={pos.downBalance}
                      onClaimed={refetchSpeed}
                    />
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Regular market positions */}
          {positions.map((pos) => {
            const totalReserve = pos.market.yesReserve + pos.market.noReserve;
            const yesPercent =
              totalReserve > 0n
                ? Number((pos.market.noReserve * 10000n) / totalReserve) / 100
                : 50;

            return (
              <Link key={pos.market.address} href={`/market/${pos.market.address}`}>
                <div className="glass-card p-4 transition-colors flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {pos.market.category}
                      </span>
                      {pos.market.resolved && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
                          Resolved
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">{pos.market.question}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Prob: {yesPercent.toFixed(1)}% YES | Vol: ${formatUSDT(pos.market.totalVolume)}
                    </p>
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
                    {portfolioAddress && pos.market.resolved && (
                      (pos.market.outcomeYes && pos.yesBalance > 0n) ||
                      (!pos.market.outcomeYes && pos.noBalance > 0n)
                    ) && (
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
