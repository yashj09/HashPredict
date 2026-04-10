import Link from "next/link";
import { MarketGrid } from "@/components/market/MarketGrid";

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
              Predict the future.
              <br />
              <span className="text-indigo-500">Trade on outcomes.</span>
            </h1>
            <p className="mt-4 text-lg text-zinc-400 leading-relaxed">
              The first prediction market on HashKey Chain. Trade on crypto prices,
              real-world assets, and ecosystem events using USDT.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                href="/create"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Create Market
              </Link>
              <Link
                href="/faucet"
                className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors"
              >
                Get Test USDT
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-semibold text-white mb-6">Markets</h2>
        <MarketGrid />
      </section>
    </div>
  );
}
