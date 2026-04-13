"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { useGaslessBuy, useGaslessSell, useGaslessAvailable } from "@/hooks/useGaslessTrade";
import { useEmbeddedWallet } from "@/hooks/useEmbeddedWallet";
import { useTokenBalance } from "@/hooks/useTrade";
import type { MarketData } from "@/hooks/useMarkets";
import { publicClient } from "@/lib/publicClient";
import { ERC20_ABI, USDT_ABI } from "@/lib/contracts";
import { formatUSDT, cn } from "@/lib/utils";

type Tab = "buy" | "sell";
type Side = "yes" | "no";

function TradingWalletPanel() {
  const {
    wallet,
    usdtBalance,
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
      <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-4 mb-4">
        <p className="text-xs text-zinc-400 mb-2">
          Create a trading wallet for instant, gasless trades — no MetaMask popups.
        </p>
        <button
          onClick={create}
          className="w-full py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          Create Trading Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-zinc-300">Trading Wallet</span>
        </div>
        <button
          onClick={() => setShowManage(!showManage)}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showManage ? "Hide" : "Manage"}
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold text-white">
          {parseFloat(formattedBalance).toFixed(2)} <span className="text-xs text-zinc-400">USDT</span>
        </span>
        <span className="text-[10px] text-zinc-600 font-mono">
          {wallet!.address.slice(0, 6)}...{wallet!.address.slice(-4)}
        </span>
      </div>

      {showManage && (
        <div className="mt-3 space-y-2 pt-3 border-t border-zinc-700/50">
          {/* Deposit */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
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

          {/* Withdraw */}
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => {
                if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
                  withdraw(withdrawAmount);
                  setWithdrawAmount("");
                }
              }}
              disabled={isWithdrawing}
              className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"
            >
              {isWithdrawing ? "..." : "Withdraw"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const gaslessAvailable = useGaslessAvailable();
  const { wallet, usdtBalance: embeddedUsdtBalance, refreshBalance } = useEmbeddedWallet();

  const tokenAddress = side === "yes" ? market.yesToken : market.noToken;

  // Gasless hooks (use embedded wallet)
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

  // Embedded wallet token balances
  const [embeddedYesBalance, setEmbeddedYesBalance] = useState<bigint>(0n);
  const [embeddedNoBalance, setEmbeddedNoBalance] = useState<bigint>(0n);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;

    async function fetch() {
      try {
        const [yes, no] = await Promise.all([
          publicClient.readContract({
            address: market.yesToken,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [wallet!.address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: market.noToken,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [wallet!.address],
          }) as Promise<bigint>,
        ]);
        if (!cancelled) {
          setEmbeddedYesBalance(yes);
          setEmbeddedNoBalance(no);
        }
      } catch {
        // ignore
      }
    }

    fetch();
    const interval = setInterval(fetch, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [wallet, market.yesToken, market.noToken]);

  // Refresh balances after trades
  useEffect(() => {
    if (gaslessBuyTxHash || gaslessSellTxHash) {
      setAmount("");
      refreshBalance();
      // Re-fetch token balances
      if (wallet) {
        Promise.all([
          publicClient.readContract({
            address: market.yesToken,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [wallet.address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: market.noToken,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [wallet.address],
          }) as Promise<bigint>,
        ]).then(([yes, no]) => {
          setEmbeddedYesBalance(yes);
          setEmbeddedNoBalance(no);
        });
      }
      onTradeComplete?.();
    }
  }, [gaslessBuyTxHash, gaslessSellTxHash]);

  const embeddedTokenBalance = side === "yes" ? embeddedYesBalance : embeddedNoBalance;
  const useEmbeddedWalletMode = gaslessAvailable && !!wallet;

  const handleTrade = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!useEmbeddedWalletMode) {
      toast.error("Create a trading wallet first");
      return;
    }
    if (tab === "buy") {
      gaslessBuy(side === "yes", amount, 6);
    } else {
      gaslessSell(side === "yes", amount, 6);
    }
  };

  const isDisabled = market.resolved || !userAddress;
  const isLoading = isGaslessBuying || isGaslessSelling;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Trade</h3>

      {/* Trading Wallet */}
      {userAddress && gaslessAvailable && <TradingWalletPanel />}

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
              ? formatUSDT(embeddedUsdtBalance)
              : parseFloat(formatUnits(embeddedTokenBalance, 6)).toFixed(2)}
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
        disabled={isDisabled || isLoading || !amount || !useEmbeddedWalletMode}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors",
          isDisabled || isLoading || !amount || !useEmbeddedWalletMode
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
          : !useEmbeddedWalletMode
            ? "Create Trading Wallet to Trade"
            : market.resolved
              ? "Market Resolved"
              : isLoading
                ? "Confirming..."
                : `${tab === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}`}
      </button>

      {useEmbeddedWalletMode && !market.resolved && (
        <p className="text-[10px] text-zinc-600 text-center mt-2">
          Instant execution — no popups, no gas fees
        </p>
      )}

      {/* User positions in embedded wallet */}
      {wallet && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-2">Your Positions</p>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">
              YES: {parseFloat(formatUnits(embeddedYesBalance, 6)).toFixed(2)}
            </span>
            <span className="text-red-400">
              NO: {parseFloat(formatUnits(embeddedNoBalance, 6)).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
