"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { USDT_ADDRESS, ERC20_ABI } from "@/lib/contracts";

function UsdtBalance() {
  const { address } = useAccount();
  const { data: balance } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  if (!address || balance === undefined) return null;

  const formatted = parseFloat(formatUnits(balance as bigint, 6)).toFixed(2);

  return (
    <div className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-sm">
      <span className="text-emerald-400 font-medium">{formatted}</span>
      <span className="text-zinc-500 ml-1">USDT</span>
    </div>
  );
}

export function Header() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-white">
              Hash<span className="text-indigo-500">Predict</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Markets
              </Link>
              <Link
                href="/speed"
                className="text-amber-400 hover:text-amber-300 transition-colors text-sm font-medium"
              >
                Speed
              </Link>
              <Link
                href="/portfolio"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Portfolio
              </Link>
              <Link
                href="/leaderboard"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Leaderboard
              </Link>
              <Link
                href="/faucet"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Faucet
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <UsdtBalance />
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
