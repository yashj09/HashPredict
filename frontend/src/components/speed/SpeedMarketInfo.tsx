"use client";

import type { SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { formatUSDT, shortenAddress, explorerAddressUrl } from "@/lib/utils";
import { SPEED_MARKET_ADDRESS } from "@/lib/contracts";

export function SpeedMarketInfo({ market }: { market: SpeedMarketData }) {
  const totalReserve = market.reserveUp + market.reserveDown;
  const upPercent = totalReserve > 0n
    ? Number((market.reserveDown * 10000n) / totalReserve) / 100
    : 50;
  const downPercent = 100 - upPercent;

  return (
    <div className="space-y-4">
      {/* Probability display */}
      <div className="glass-card p-5">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">UP Probability</p>
            <p className="text-4xl font-bold text-emerald-400">{upPercent.toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-1">DOWN Probability</p>
            <p className="text-4xl font-bold text-red-400">{downPercent.toFixed(1)}%</p>
          </div>
        </div>
        <div className="h-3 prob-bar-track flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${upPercent}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${downPercent}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-3">
          <p className="text-xs text-slate-500 mb-0.5">Liquidity</p>
          <p className="text-sm font-semibold text-slate-200">${formatUSDT(market.totalCollateral)}</p>
        </div>
        <div className="glass-panel p-3">
          <p className="text-xs text-slate-500 mb-0.5">Contract</p>
          <a
            href={explorerAddressUrl(SPEED_MARKET_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            {shortenAddress(SPEED_MARKET_ADDRESS)}
          </a>
        </div>
      </div>
    </div>
  );
}
