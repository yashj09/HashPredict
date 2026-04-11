// SUPRA Oracle constants and helpers

export const SUPRA_TESTNET_API = "https://rpc-testnet-dora-2.supra.com";

export const SUPRA_RESOLVER_ADDRESS =
  (process.env.NEXT_PUBLIC_SUPRA_RESOLVER_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as `0x${string}`);

// SUPRA pair indexes: https://docs.supra.com/oracles/data-feeds/data-feeds-index
export const SUPRA_PAIRS: Record<string, { id: number; label: string }> = {
  BTC_USD: { id: 18, label: "BTC/USD" },
  ETH_USD: { id: 19, label: "ETH/USD" },
  BTC_USDT: { id: 0, label: "BTC/USDT" },
  ETH_USDT: { id: 1, label: "ETH/USDT" },
  USDT_USD: { id: 48, label: "USDT/USD" },
  USDC_USD: { id: 89, label: "USDC/USD" },
};

export function getPairLabel(pairId: number): string {
  for (const pair of Object.values(SUPRA_PAIRS)) {
    if (pair.id === pairId) return pair.label;
  }
  return `Pair #${pairId}`;
}

/**
 * Fetch proof bytes from SUPRA's REST API for on-chain verification.
 * The returned hex string is passed directly to SupraResolver.resolveWithPrice().
 */
export async function fetchSupraProof(
  pairIndexes: number[]
): Promise<`0x${string}`> {
  const resp = await fetch(`${SUPRA_TESTNET_API}/get_proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pair_indexes: pairIndexes,
      chain_type: "evm",
    }),
  });

  if (!resp.ok) {
    throw new Error(`SUPRA API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const proofHex = data.evm?.proof_bytes ?? data.proof_bytes;
  if (!proofHex) throw new Error("No proof_bytes in SUPRA response");

  return (proofHex.startsWith("0x") ? proofHex : `0x${proofHex}`) as `0x${string}`;
}
