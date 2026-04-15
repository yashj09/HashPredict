"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import type { SpeedMarketData } from "@/hooks/useSpeedMarkets";
import { useSpeedBuy, useSpeedClaim, useSpeedUserBalances } from "@/hooks/useSpeedTrade";
import { useGaslessSpeedBuy, useGaslessSpeedClaim } from "@/hooks/useGaslessSpeedTrade";
import { useGaslessAvailable } from "@/hooks/useGaslessTrade";
import { useEmbeddedWallet } from "@/hooks/useEmbeddedWallet";
import { formatUSDT, cn } from "@/lib/utils";

type Side = "up" | "down";

const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];

function TradingWalletPanel() {
  const {
    wallet,
    formattedBalance,
    create,
    deposit,
    withdraw,
    isDepositing,
    isWithdrawing,
    hasWallet,
  } = useEmbeddedWallet();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showManage, setShowManage] = useState(false);

  if (!hasWallet) {
    return (
      <div className="glass-panel border-dashed p-4 mb-4">
        <p className="text-xs text-slate-400 mb-2">
          Create a trading wallet for instant, gasless trades — no MetaMask popups.
        </p>
        <button
          onClick={create}
          className="w-full py-2 rounded-lg text-sm btn-gradient-primary text-white"
        >
          Create Trading Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-slate-300">Trading Wallet</span>
        </div>
        <button
          onClick={() => setShowManage(!showManage)}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          {showManage ? "Hide" : "Manage"}
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold text-white">
          {parseFloat(formattedBalance).toFixed(2)} <span className="text-xs text-slate-400">USDT</span>
        </span>
        <span className="text-[10px] text-slate-600 font-mono">
          {wallet!.address.slice(0, 6)}...{wallet!.address.slice(-4)}
        </span>
      </div>

      {showManage && (
        <div className="mt-3 space-y-2 pt-3 border-t border-[var(--glass-border)]">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="flex-1 px-2 py-1.5 glass-input text-xs"
            />
            <button
              onClick={() => {
                if (depositAmount && parseFloat(depositAmount) > 0) {
                  deposit(depositAmount);
                  setDepositAmount("");
                }
              }}
              disabled={isDepositing}
              className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              {isDepositing ? "..." : "Deposit"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="flex-1 px-2 py-1.5 glass-input text-xs"
            />
            <button
              onClick={() => {
                if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
                  withdraw(withdrawAmount);
                  setWithdrawAmount("");
                }
              }}
              disabled={isWithdrawing}
              className="px-3 py-1.5 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
            >
              {isWithdrawing ? "..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SpeedTradingPanel({
  market,
  onTradeComplete,
}: {
  market: SpeedMarketData;
  onTradeComplete?: () => void;
}) {
  const { address: userAddress } = useAccount();
  const [side, setSide] = useState<Side>("up");
  const [amount, setAmount] = useState("");

  const gaslessAvailable = useGaslessAvailable();
  const { wallet, usdtBalance: embeddedUsdtBalance, refreshBalance } = useEmbeddedWallet();

  const { buy, isLoading: buyLoading } = useSpeedBuy();
  const { claim, isLoading: claimLoading } = useSpeedClaim();
  const { executeBuy: gaslessBuy, isLoading: gaslessBuyLoading, txHash: gaslessTxHash } = useGaslessSpeedBuy();
  const { claim: gaslessClaim, isLoading: gaslessClaimLoading } = useGaslessSpeedClaim();
  const { data: userBalances } = useSpeedUserBalances(market.marketId);

  const upBalance = userBalances ? (userBalances as [bigint, bigint])[0] : 0n;
  const downBalance = userBalances ? (userBalances as [bigint, bigint])[1] : 0n;

  const useEmbeddedWalletMode = gaslessAvailable && !!wallet;
  const isActive = !market.resolved && market.expiry > Math.floor(Date.now() / 1000);
  const isLoading = buyLoading || gaslessBuyLoading;

  const hasWinnings =
    market.resolved &&
    ((market.outcomeIsUp && upBalance > 0n) || (!market.outcomeIsUp && downBalance > 0n));

  // Refresh after gasless trade
  useEffect(() => {
    if (gaslessTxHash) {
      setAmount("");
      refreshBalance();
      onTradeComplete?.();
    }
  }, [gaslessTxHash]);

  async function handleTrade() {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const isUp = side === "up";

    try {
      if (useEmbeddedWalletMode) {
        await gaslessBuy(market.marketId, isUp, amount);
      } else {
        await buy(market.marketId, isUp, amount);
        toast.success(`${isUp ? "UP" : "DOWN"} trade submitted!`);
        setAmount("");
        onTradeComplete?.();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Trade failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    }
  }

  async function handleClaim() {
    try {
      if (useEmbeddedWalletMode) {
        await gaslessClaim(market.marketId);
      } else {
        await claim(market.marketId);
        toast.success("Claimed!");
      }
      onTradeComplete?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    }
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">Trade</h3>

      {/* Trading wallet */}
      {userAddress && gaslessAvailable && <TradingWalletPanel />}

      {/* Resolved + claim */}
      {market.resolved && (
        <div className="mb-4">
          <div className={cn(
            "text-center py-3 rounded-lg mb-3 font-bold",
            market.outcomeIsUp
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400",
          )}>
            Resolved: {market.outcomeIsUp ? "UP" : "DOWN"}
          </div>
          {hasWinnings && (
            <button
              onClick={handleClaim}
              disabled={claimLoading || gaslessClaimLoading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              {claimLoading || gaslessClaimLoading ? "Claiming..." : "Claim Winnings"}
            </button>
          )}
        </div>
      )}

      {/* Active trading */}
      {isActive && (
        <>
          {/* UP / DOWN side */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSide("up")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                side === "up"
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                  : "border-slate-700 text-slate-400 hover:border-slate-600",
              )}
            >
              UP
            </button>
            <button
              onClick={() => setSide("down")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                side === "down"
                  ? "bg-red-600/20 border-red-500 text-red-400"
                  : "border-slate-700 text-slate-400 hover:border-slate-600",
              )}
            >
              DOWN
            </button>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5 mb-3">
            {QUICK_AMOUNTS.map((qa) => (
              <button
                key={qa}
                onClick={() => setAmount(qa)}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-md font-medium transition-colors",
                  amount === qa
                    ? "btn-gradient-primary text-white"
                    : "glass-panel text-slate-400 hover:text-slate-200",
                )}
              >
                ${qa}
              </button>
            ))}
          </div>

          {/* Amount input */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Amount (USDT)</span>
              <span>Balance: {useEmbeddedWalletMode ? formatUSDT(embeddedUsdtBalance) : "--"}</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 glass-input text-sm"
            />
          </div>

          {/* Trade button */}
          <button
            onClick={handleTrade}
            disabled={!userAddress || isLoading || !amount}
            className={cn(
              "w-full py-3 rounded-lg text-sm font-bold transition-colors",
              !userAddress || isLoading || !amount
                ? "bg-slate-800/50 text-slate-500 cursor-not-allowed"
                : side === "up"
                  ? "btn-gradient-up text-white"
                  : "btn-gradient-down text-white",
            )}
          >
            {!userAddress
              ? "Connect Wallet"
              : isLoading
                ? "Confirming..."
                : `Buy ${side.toUpperCase()}`}
          </button>

          {useEmbeddedWalletMode && (
            <p className="text-[10px] text-slate-600 text-center mt-2">
              Instant execution — no popups, no gas fees
            </p>
          )}
        </>
      )}

      {/* Not active, not resolved */}
      {!isActive && !market.resolved && (
        <div className="text-center py-4 text-slate-500 text-sm">
          Market expired — awaiting resolution
        </div>
      )}

      {/* User positions */}
      {userAddress && (upBalance > 0n || downBalance > 0n) && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2">Your Positions</p>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">
              UP: {parseFloat(formatUnits(upBalance, 6)).toFixed(2)}
            </span>
            <span className="text-red-400">
              DOWN: {parseFloat(formatUnits(downBalance, 6)).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
