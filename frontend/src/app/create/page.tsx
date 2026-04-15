"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, parseAbiItem } from "viem";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FACTORY_ADDRESS, FACTORY_ABI, USDT_ADDRESS, USDT_ABI, SUPRA_RESOLVER_ABI } from "@/lib/contracts";
import { SUPRA_RESOLVER_ADDRESS, SUPRA_PAIRS } from "@/lib/supra";
import { publicClient } from "@/lib/publicClient";

const categories = ["Crypto", "RWA", "Ecosystem"];

const pairOptions = Object.entries(SUPRA_PAIRS).map(([key, val]) => ({
  key,
  ...val,
}));

const MarketCreatedEvent = parseAbiItem(
  "event MarketCreated(address indexed market, address indexed creator, string question, string category, address collateralToken, uint256 endTimestamp, uint256 initialLiquidity)"
);

export default function CreateMarketPage() {
  const { address: userAddress } = useAccount();
  const router = useRouter();

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("Crypto");
  const [endDate, setEndDate] = useState("");
  const [liquidity, setLiquidity] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Oracle config
  const [enableOracle, setEnableOracle] = useState(false);
  const [oraclePair, setOraclePair] = useState(pairOptions[0].key);
  const [oracleTarget, setOracleTarget] = useState("");
  const [oracleAbove, setOracleAbove] = useState(true);

  const hasResolver = SUPRA_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000";
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
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      toast.info("Creating market...");
      const createHash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createMarket",
        args: [question, category, USDT_ADDRESS, liquidityParsed, endTimestamp],
        gas: 5_000_000n,
      });

      toast.info("Waiting for market creation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: createHash });

      // Parse MarketCreated event to get new market address
      let newMarketAddress: `0x${string}` | undefined;
      for (const log of receipt.logs) {
        try {
          if (log.address.toLowerCase() === FACTORY_ADDRESS.toLowerCase()) {
            const { parseEventLogs } = await import("viem");
            const parsed = parseEventLogs({ abi: [MarketCreatedEvent], logs: [log] });
            if (parsed.length > 0) {
              newMarketAddress = parsed[0].args.market;
            }
          }
        } catch {
          // Not this event, continue
        }
      }

      // Configure oracle if enabled and we got the market address
      if (enableOracle && oracleTarget && newMarketAddress) {
        try {
          toast.info("Configuring oracle...");
          const pair = SUPRA_PAIRS[oraclePair];
          const targetRaw = parseUnits(oracleTarget, 18);
          const oracleHash = await writeContractAsync({
            address: SUPRA_RESOLVER_ADDRESS,
            abi: SUPRA_RESOLVER_ABI,
            functionName: "configureMarket",
            args: [newMarketAddress, pair.id, targetRaw, oracleAbove],
            gas: 200_000n,
          });
          await publicClient.waitForTransactionReceipt({ hash: oracleHash });
          toast.success("Oracle configured!");
        } catch (oracleErr: unknown) {
          const oMsg = oracleErr instanceof Error ? oracleErr.message : "Oracle config failed";
          toast.error("Market created but oracle config failed: " + (oMsg.length > 100 ? oMsg.slice(0, 100) + "..." : oMsg));
        }
      }

      toast.success("Market created!");
      router.push(newMarketAddress ? `/market/${newMarketAddress}` : "/");
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
          <label className="block text-sm text-slate-400 mb-1.5">Question</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will BTC hit $100,000 by June 2026?"
            className="w-full px-3 py-2.5 glass-input text-sm"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Category</label>
          <div className="flex gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  category === c
                    ? "bg-teal-600/20 border-teal-500 text-teal-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* End date */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Resolution Date</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 glass-input text-sm [color-scheme:dark]"
          />
        </div>

        {/* Initial liquidity */}
        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Initial Liquidity (USDT)</label>
          <input
            type="number"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            placeholder="100"
            className="w-full px-3 py-2.5 glass-input text-sm"
          />
          <p className="text-xs text-slate-600 mt-1">Minimum 10 USDT. A 1% creation fee applies.</p>
        </div>

        {/* Oracle Resolution (optional) */}
        {hasResolver && (
          <div className="rounded-xl border border-slate-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300 font-medium">
                Oracle Resolution (SUPRA)
              </label>
              <button
                type="button"
                onClick={() => setEnableOracle(!enableOracle)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  enableOracle ? "bg-teal-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    enableOracle ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {enableOracle && (
              <>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Price Feed</label>
                  <select
                    value={oraclePair}
                    onChange={(e) => setOraclePair(e.target.value)}
                    className="w-full px-3 py-2 glass-input text-sm"
                  >
                    {pairOptions.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Target Price (USD)</label>
                  <input
                    type="number"
                    value={oracleTarget}
                    onChange={(e) => setOracleTarget(e.target.value)}
                    placeholder="e.g. 100000"
                    className="w-full px-3 py-2 glass-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Condition</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOracleAbove(true)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        oracleAbove
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                          : "border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      YES if price above
                    </button>
                    <button
                      type="button"
                      onClick={() => setOracleAbove(false)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        !oracleAbove
                          ? "bg-red-600/20 border-red-500 text-red-400"
                          : "border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      YES if price below
                    </button>
                  </div>
                </div>

                {oracleTarget && (
                  <p className="text-xs text-amber-400">
                    Will auto-resolve: YES if {SUPRA_PAIRS[oraclePair].label}{" "}
                    {oracleAbove ? "≥" : "<"} ${Number(oracleTarget).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCreate}
          disabled={!userAddress || isLoading || !question || !endDate || !liquidity}
          className="w-full py-3 rounded-lg text-sm font-semibold btn-gradient-primary text-white transition-colors disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
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
