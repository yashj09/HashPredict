"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FACTORY_ADDRESS, FACTORY_ABI, USDT_ADDRESS, USDT_ABI } from "@/lib/contracts";

const categories = ["Crypto", "RWA", "Ecosystem"];

export default function CreateMarketPage() {
  const { address: userAddress } = useAccount();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("Crypto");
  const [endDate, setEndDate] = useState("");
  const [liquidity, setLiquidity] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { writeContractAsync } = useWriteContract();

  const handleCreate = async () => {
    if (!question || !endDate || !liquidity) {
      toast.error("Fill in all fields");
      return;
    }

    const endTimestamp = BigInt(Math.floor(new Date(endDate).getTime() / 1000));
    const liquidityParsed = parseUnits(liquidity, 6);

    setIsLoading(true);
    try {
      toast.info("Approving USDT spend...");
      const approveHash = await writeContractAsync({
        address: USDT_ADDRESS,
        abi: USDT_ABI,
        functionName: "approve",
        args: [FACTORY_ADDRESS, liquidityParsed],
        gas: 100_000n,
      });

      toast.info("Waiting for approval confirmation...");
      const { publicClient } = await import("@/lib/publicClient");
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      toast.info("Creating market...");
      await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createMarket",
        args: [question, category, USDT_ADDRESS, liquidityParsed, endTimestamp],
        gas: 5_000_000n,
      });

      toast.success("Market created!");
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">Create Market</h1>

      <div className="space-y-5">
        {/* Question */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Question</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will BTC hit $100,000 by June 2026?"
            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-zinc-600"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Category</label>
          <div className="flex gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  category === c
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* End date */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Resolution Date</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
          />
        </div>

        {/* Initial liquidity */}
        <div>
          <label className="block text-sm text-zinc-400 mb-1.5">Initial Liquidity (USDT)</label>
          <input
            type="number"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            placeholder="100"
            className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-zinc-600"
          />
          <p className="text-xs text-zinc-600 mt-1">Minimum 10 USDT. A 1% creation fee applies.</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!userAddress || isLoading || !question || !endDate || !liquidity}
          className="w-full py-3 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
        >
          {!userAddress
            ? "Connect Wallet"
            : isLoading
              ? "Creating Market..."
              : "Create Market"}
        </button>
      </div>
    </div>
  );
}
