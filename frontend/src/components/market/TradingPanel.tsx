"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { useApproveAndBuy, useApproveAndSell, useTokenBalance, useUsdtBalance } from "@/hooks/useTrade";
import { useGaslessBuy, useGaslessSell, useGaslessAvailable } from "@/hooks/useGaslessTrade";
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
  const [gasless, setGasless] = useState(true);

  const gaslessAvailable = useGaslessAvailable();

  const tokenAddress = side === "yes" ? market.yesToken : market.noToken;

  // Normal (gas-paying) hooks
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

  // Gasless hooks
  const {
    executeBuy: gaslessBuy,
    isLoading: isGaslessBuying,
    txHash: gaslessBuyTxHash,
  } = useGaslessBuy(market.address, market.collateralToken);

  const {
    executeSell: gaslessSell,
    isLoading: isGaslessSelling,
    txHash: gaslessSellTxHash,
  } = useGaslessSell(market.address, tokenAddress);

  const { data: usdtBalance } = useUsdtBalance(market.collateralToken, userAddress);
  const { data: yesBalance } = useTokenBalance(market.yesToken, userAddress);
  const { data: noBalance } = useTokenBalance(market.noToken, userAddress);

  const tokenBalance = side === "yes" ? yesBalance : noBalance;

  useEffect(() => {
    if (isBuyConfirmed) {
      setAmount("");
      onTradeComplete?.();
    }
  }, [isBuyConfirmed]);

  useEffect(() => {
    if (isSellConfirmed) {
      setAmount("");
      onTradeComplete?.();
    }
  }, [isSellConfirmed]);

  // Handle gasless tx completion via txHash changes
  useEffect(() => {
    if (gaslessBuyTxHash) {
      setAmount("");
      onTradeComplete?.();
    }
  }, [gaslessBuyTxHash]);

  useEffect(() => {
    if (gaslessSellTxHash) {
      setAmount("");
      onTradeComplete?.();
    }
  }, [gaslessSellTxHash]);

  const useGaslessMode = gasless && gaslessAvailable;

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (useGaslessMode) {
      if (tab === "buy") {
        gaslessBuy(side === "yes", amount, 6);
      } else {
        gaslessSell(side === "yes", amount, 6);
      }
    } else {
      if (tab === "buy") {
        executeBuy(side === "yes", amount, 6);
      } else {
        executeSell(side === "yes", amount, 6);
      }
    }
  };

  const isDisabled = market.resolved || !userAddress;
  const isLoading = isBuying || isSelling || isGaslessBuying || isGaslessSelling;

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
                ? parseFloat(formatUnits(tokenBalance as bigint, 6)).toFixed(2)
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

      {/* Gasless toggle */}
      {gaslessAvailable && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">Gasless</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-400 font-medium">
              No gas fees
            </span>
          </div>
          <button
            type="button"
            onClick={() => setGasless(!gasless)}
            className={cn(
              "relative w-9 h-5 rounded-full transition-colors",
              gasless ? "bg-emerald-600" : "bg-zinc-700",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                gasless && "translate-x-4",
              )}
            />
          </button>
        </div>
      )}

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
              ? useGaslessMode ? "Signing..." : "Confirming..."
              : `${tab === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}${useGaslessMode ? " (Gasless)" : ""}`}
      </button>

      {/* User positions */}
      {userAddress && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Your Positions</p>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">
              YES: {yesBalance != null ? parseFloat(formatUnits(yesBalance as bigint, 6)).toFixed(2) : "0"}
            </span>
            <span className="text-red-400">
              NO: {noBalance != null ? parseFloat(formatUnits(noBalance as bigint, 6)).toFixed(2) : "0"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
