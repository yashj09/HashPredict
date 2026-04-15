import Link from "next/link";
import { MarketGrid } from "@/components/market/MarketGrid";

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-[var(--glass-border)] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 relative">
          <div className="max-w-2xl">
            <p className="text-teal-400 text-sm font-medium tracking-wider uppercase mb-3">On-chain prediction markets</p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
              Bet on what happens
              <br />
              <span className="neon-text">next.</span>
            </h1>
            <p className="mt-4 text-base text-slate-400 leading-relaxed max-w-lg">
              Trade 15-minute speed markets on BTC, ETH &amp; SOL prices or long-term prediction markets &mdash; all on HashKey Chain with gasless USDT trades.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/speed"
                className="btn-gradient-primary px-6 py-2.5 text-sm rounded-lg"
              >
                Trade Speed Markets
              </Link>
              <Link
                href="/faucet"
                className="glass-panel px-6 py-2.5 text-slate-200 text-sm font-medium hover:text-white hover:bg-slate-700/40 transition-colors"
              >
                Get Test USDT
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-display text-xl font-semibold text-white mb-6">Markets</h2>
        <MarketGrid />
      </section>
    </div>
  );
}
