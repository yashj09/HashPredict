"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import { SUPRA_RESOLVER_ADDRESS, SUPRA_PAIRS } from "@/lib/supra";
import { SUPRA_RESOLVER_ABI } from "@/lib/contracts";
import { publicClient } from "@/lib/publicClient";
import { useOracleConfig } from "@/hooks/useSupraResolver";

const pairOptions = Object.entries(SUPRA_PAIRS).map(([key, val]) => ({
  key,
  ...val,
}));

export function OracleAdmin({
  marketAddress,
  onConfigured,
}: {
  marketAddress: `0x${string}`;
  onConfigured?: () => void;
}) {
  const { address } = useAccount();
  const { config: existingConfig } = useOracleConfig(marketAddress);

  // Check if connected wallet is the resolver owner
  const { data: ownerAddress } = useReadContract({
    address: SUPRA_RESOLVER_ADDRESS,
    abi: SUPRA_RESOLVER_ABI,
    functionName: "owner",
    query: {
      enabled: SUPRA_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  const isOwner =
    !!address &&
    !!ownerAddress &&
    (address as string).toLowerCase() === (ownerAddress as string).toLowerCase();

  const [selectedPair, setSelectedPair] = useState(pairOptions[0].key);
  const [targetPrice, setTargetPrice] = useState("");
  const [resolveYesIfAbove, setResolveYesIfAbove] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { writeContractAsync } = useWriteContract();

  // Don't render if not owner, already configured, or resolver not deployed
  if (!isOwner || existingConfig) return null;

  const handleConfigure = async () => {
    if (!targetPrice) {
      toast.error("Enter a target price");
      return;
    }

    const pair = SUPRA_PAIRS[selectedPair];
    // SUPRA prices use 18 decimals
    const targetRaw = parseUnits(targetPrice, 18);

    setIsLoading(true);
    try {
      toast.info("Configuring oracle...");
      const hash = await writeContractAsync({
        address: SUPRA_RESOLVER_ADDRESS,
        abi: SUPRA_RESOLVER_ABI,
        functionName: "configureMarket",
        args: [marketAddress, pair.id, targetRaw, resolveYesIfAbove],
        gas: 200_000n,
      });

      toast.info("Waiting for confirmation...");
      await publicClient.waitForTransactionReceipt({ hash });
      toast.success(`Oracle configured: ${pair.label}`);
      onConfigured?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Configuration failed";
      toast.error(msg.length > 150 ? msg.slice(0, 150) + "..." : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-slate-500" />
        <h4 className="text-sm font-medium text-slate-300">
          Configure Oracle (Admin)
        </h4>
      </div>

      <div className="space-y-3">
        {/* Price Pair */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Price Feed</label>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="w-full px-3 py-2 glass-input text-sm"
          >
            {pairOptions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} (ID: {p.id})
              </option>
            ))}
          </select>
        </div>

        {/* Target Price */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Target Price (USD)
          </label>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="e.g. 100000"
            className="w-full px-3 py-2 glass-input text-sm placeholder-zinc-600"
          />
        </div>

        {/* Condition */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Condition</label>
          <div className="flex gap-2">
            <button
              onClick={() => setResolveYesIfAbove(true)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                resolveYesIfAbove
                  ? "bg-emerald-600/20 border-emerald-500 text-emerald-400"
                  : "border-slate-700/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              YES if above
            </button>
            <button
              onClick={() => setResolveYesIfAbove(false)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                !resolveYesIfAbove
                  ? "bg-red-600/20 border-red-500 text-red-400"
                  : "border-slate-700/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              YES if below
            </button>
          </div>
        </div>

        {/* Preview */}
        {targetPrice && (
          <p className="text-xs text-slate-400">
            Resolves YES if {SUPRA_PAIRS[selectedPair].label}{" "}
            {resolveYesIfAbove ? "≥" : "<"} ${Number(targetPrice).toLocaleString()}
          </p>
        )}

        {/* Configure Button */}
        <button
          onClick={handleConfigure}
          disabled={isLoading || !targetPrice}
          className="w-full py-2 rounded-lg text-sm font-medium btn-gradient-primary text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Configuring..." : "Configure Oracle"}
        </button>
      </div>
    </div>
  );
}
