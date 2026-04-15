"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { USDT_ADDRESS, ERC20_ABI } from "@/lib/contracts";
import { cn } from "@/lib/utils";

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
    <div className="glass-panel px-3 py-1.5 text-sm">
      <span className="text-emerald-400 font-medium">{formatted}</span>
      <span className="text-slate-500 ml-1">USDT</span>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Markets", match: (p: string) => p === "/" },
  { href: "/speed", label: "Speed", match: (p: string) => p.startsWith("/speed"), amber: true },
  { href: "/portfolio", label: "Portfolio", match: (p: string) => p === "/portfolio" },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p === "/leaderboard" },
  { href: "/faucet", label: "Faucet", match: (p: string) => p === "/faucet" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="glass border-b border-[var(--glass-border)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-display text-xl font-bold text-white tracking-wide">
              Hash<span className="neon-text">Predict</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? item.amber
                          ? "text-amber-400 bg-amber-500/10 font-medium"
                          : "text-teal-400 bg-teal-500/10 font-medium"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
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
