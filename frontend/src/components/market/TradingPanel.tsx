"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { useApproveAndBuy, useApproveAndSell, useTokenBalance, useUsdtBalance } from "@/hooks/useTrade";
import type { MarketData } from "@/hooks/useMarkets";
import { formatUSDT, cn } from "@/lib/utils";

type Tab = "buy" | "sell";
type Side = "yes" | "no";

export function TradingPanel({
  market,
  onTradeComplete,
}: {
  market: MarketData;
  onTradeComplete?: () => void;
}) {
  const { address: userAddress } = useAccount();
  const [tab, setTab] = useState<Tab>("buy");
  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState("");

  const tokenAddress = side === "yes" ? market.yesToken : market.noToken;

  const {
    executeBuy,
    isLoading: isBuying,
    isBuyConfirmed,
  } = useApproveAndBuy(market.address, market.collateralToken);

  const {
    executeSell,
    isLoading: isSelling,
    isSellConfirmed,
  } = useApproveAndSell(market.address, tokenAddress);

  const { data: usdtBalance } = useUsdtBalance(market.collateralToken, userAddress);
  const { data: yesBalance } = useTokenBalance(market.yesToken, userAddress);
  const { data: noBalance } = useTokenBalance(market.noToken, userAddress);

  const tokenBalance = side === "yes" ? yesBalance : noBalance;

  useEffect(() => {
    if (isBuyConfirmed) {
      toast.success(`Bought ${side.toUpperCase()} tokens!`);
      setAmount("");
      onTradeComplete?.();
    }
  }, [isBuyConfirmed]);

  useEffect(() => {
    if (isSellConfirmed) {
      toast.success(`Sold ${side.toUpperCase()} tokens!`);
      setAmount("");
      onTradeComplete?.();
    }
  }, [isSellConfirmed]);

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (tab === "buy") {
      executeBuy(side === "yes", amount, 6);
    } else {
      executeSell(side === "yes", amount, 18);
    }
  };

  const isEnded = Number(market.endTimestamp) * 1000 < Date.now();
  const isDisabled = market.resolved || !userAddress;
  const isLoading = isBuying || isSelling;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Trade</h3>

      {/* Buy / Sell tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-800 rounded-lg p-1">
        {(["buy", "sell"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
              tab === t
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Yes / No side */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide("yes")}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
            side === "yes"
              ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-600",
          )}
        >
          Yes
        </button>
        <button
          onClick={() => setSide("no")}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
            side === "no"
              ? "bg-red-600/20 border-red-500 text-red-400"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-600",
          )}
        >
          No
        </button>
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
          <span>{tab === "buy" ? "Amount (USDT)" : "Amount (tokens)"}</span>
          <span>
            Balance:{" "}
            {tab === "buy"
              ? usdtBalance != null
                ? formatUSDT(usdtBalance as bigint)
                : "—"
              : tokenBalance != null
                ? parseFloat(formatUnits(tokenBalance as bigint, 18)).toFixed(2)
                : "—"}
          </span>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-zinc-600"
          disabled={isDisabled}
        />
      </div>

      {/* Trade button */}
      <button
        onClick={handleTrade}
        disabled={isDisabled || isLoading || !amount}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
          isDisabled || isLoading || !amount
            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            : tab === "buy"
              ? side === "yes"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-red-600 hover:bg-red-500 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white",
        )}
      >
        {!userAddress
          ? "Connect Wallet"
          : market.resolved
            ? "Market Resolved"
            : isLoading
              ? "Confirming..."
              : `${tab === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}`}
      </button>

      {/* User positions */}
      {userAddress && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Your Positions</p>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">
              YES: {yesBalance != null ? parseFloat(formatUnits(yesBalance as bigint, 18)).toFixed(2) : "0"}
            </span>
            <span className="text-red-400">
              NO: {noBalance != null ? parseFloat(formatUnits(noBalance as bigint, 18)).toFixed(2) : "0"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
