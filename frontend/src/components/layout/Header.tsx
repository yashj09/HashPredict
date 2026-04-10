"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

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
                href="/create"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Create
              </Link>
              <Link
                href="/portfolio"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Portfolio
              </Link>
              <Link
                href="/faucet"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Faucet
              </Link>
            </nav>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
