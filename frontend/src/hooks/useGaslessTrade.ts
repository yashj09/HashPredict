"use client";

import { useState } from "react";
import { encodeFunctionData, parseUnits, maxUint256 } from "viem";
import { toast } from "sonner";
import { FORWARDER_ADDRESS, FORWARDER_ABI, MARKET_ABI, USDT_ABI } from "@/lib/contracts";
import { publicClient } from "@/lib/publicClient";
import { getEmbeddedWallet, getEmbeddedWalletClient, getEmbeddedAccount } from "@/lib/embeddedWallet";
import { explorerTxUrl } from "@/lib/utils";

// EIP-712 types for the ERC2771Forwarder
const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

// EIP-2612 Permit types
const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const CHAIN_ID = 133;

async function getForwarderNonce(userAddress: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: FORWARDER_ADDRESS,
    abi: FORWARDER_ABI,
    functionName: "nonces",
    args: [userAddress],
  }) as Promise<bigint>;
}

async function getPermitNonce(tokenAddress: `0x${string}`, userAddress: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: USDT_ABI,
    functionName: "nonces",
    args: [userAddress],
  }) as Promise<bigint>;
}

async function getTokenName(tokenAddress: `0x${string}`): Promise<string> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: [{ type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }],
    functionName: "name",
  }) as Promise<string>;
}

async function getAllowance(tokenAddress: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: tokenAddress,
    abi: USDT_ABI,
    functionName: "allowance",
    args: [owner, spender],
  }) as Promise<bigint>;
}

interface RelayResponse {
  txHash: `0x${string}`;
  status: string;
  blockNumber: string;
}

async function submitToRelayer(payload: {
  permit?: {
    token: `0x${string}`;
    owner: `0x${string}`;
    spender: `0x${string}`;
    value: string;
    deadline: string;
    v: number;
    r: `0x${string}`;
    s: `0x${string}`;
  };
  forwardRequest: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: string;
    gas: string;
    deadline: number;
    data: `0x${string}`;
    signature: `0x${string}`;
  };
}): Promise<RelayResponse> {
  const resp = await fetch("/api/relay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Relay request failed");
  return data;
}

/** Check whether gasless trading is available */
export function useGaslessAvailable() {
  return FORWARDER_ADDRESS !== "0x0000000000000000000000000000000000000000";
}

/**
 * Auto-sign a permit using the embedded wallet. No MetaMask popup.
 * Returns the permit payload, or undefined if allowance is already sufficient.
 */
async function autoSignPermit(
  walletClient: ReturnType<typeof getEmbeddedWalletClient>,
  account: ReturnType<typeof getEmbeddedAccount>,
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  amount: bigint,
) {
  const currentAllowance = await getAllowance(tokenAddress, ownerAddress, spenderAddress);
  if (currentAllowance >= amount) return undefined;

  const [permitNonce, tokenName] = await Promise.all([
    getPermitNonce(tokenAddress, ownerAddress),
    getTokenName(tokenAddress),
  ]);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const sig = await walletClient.signTypedData({
    account,
    domain: {
      name: tokenName,
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: tokenAddress,
    },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner: ownerAddress,
      spender: spenderAddress,
      value: maxUint256,
      nonce: permitNonce,
      deadline,
    },
  });

  return {
    token: tokenAddress,
    owner: ownerAddress,
    spender: spenderAddress,
    value: maxUint256.toString(),
    deadline: deadline.toString(),
    v: parseInt(sig.slice(130, 132), 16),
    r: `0x${sig.slice(2, 66)}` as `0x${string}`,
    s: `0x${sig.slice(66, 130)}` as `0x${string}`,
  };
}

/**
 * Auto-sign a ForwardRequest using the embedded wallet. No MetaMask popup.
 */
async function autoSignForwardRequest(
  walletClient: ReturnType<typeof getEmbeddedWalletClient>,
  account: ReturnType<typeof getEmbeddedAccount>,
  from: `0x${string}`,
  to: `0x${string}`,
  data: `0x${string}`,
  gas: bigint,
) {
  const forwarderNonce = await getForwarderNonce(from);
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const sig = await walletClient.signTypedData({
    account,
    domain: {
      name: "HashPredictForwarder",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: FORWARDER_ADDRESS,
    },
    types: FORWARD_REQUEST_TYPES,
    primaryType: "ForwardRequest",
    message: {
      from,
      to,
      value: 0n,
      gas,
      nonce: forwarderNonce,
      deadline,
      data,
    },
  });

  return {
    from,
    to,
    value: "0",
    gas: gas.toString(),
    deadline,
    data,
    signature: sig,
  };
}

export function useGaslessBuy(
  marketAddress: `0x${string}`,
  collateralToken: `0x${string}`,
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const executeBuy = async (isYes: boolean, amount: string, decimals: number = 6) => {
    const wallet = getEmbeddedWallet();
    if (!wallet) {
      toast.error("Create a trading wallet first");
      return;
    }

    const parsed = parseUnits(amount, decimals);
    setIsProcessing(true);
    setTxHash(undefined);

    try {
      toast.info("Executing trade...");
      const walletClient = getEmbeddedWalletClient(wallet);
      const account = getEmbeddedAccount(wallet);

      // Auto-sign permit if needed (no popup)
      const permit = await autoSignPermit(
        walletClient, account, collateralToken, wallet.address, marketAddress, parsed,
      );

      // Auto-sign the ForwardRequest (no popup)
      const buyCalldata = encodeFunctionData({
        abi: MARKET_ABI,
        functionName: "buy",
        args: [isYes, parsed],
      });

      const forwardRequest = await autoSignForwardRequest(
        walletClient, account, wallet.address, marketAddress, buyCalldata, 800_000n,
      );

      const result = await submitToRelayer({ permit, forwardRequest });
      setTxHash(result.txHash);
      toast.success("Trade confirmed!", {
        action: { label: "View Transaction", onClick: () => window.open(explorerTxUrl(result.txHash), "_blank") },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Trade failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return { executeBuy, isLoading: isProcessing, txHash };
}

export function useGaslessSell(
  marketAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const executeSell = async (isYes: boolean, amount: string, decimals: number = 6) => {
    const wallet = getEmbeddedWallet();
    if (!wallet) {
      toast.error("Create a trading wallet first");
      return;
    }

    const parsed = parseUnits(amount, decimals);
    setIsProcessing(true);
    setTxHash(undefined);

    try {
      toast.info("Executing sell...");
      const walletClient = getEmbeddedWalletClient(wallet);
      const account = getEmbeddedAccount(wallet);

      // Auto-sign permit for outcome token if needed
      const permit = await autoSignPermit(
        walletClient, account, tokenAddress, wallet.address, marketAddress, parsed,
      );

      const sellCalldata = encodeFunctionData({
        abi: MARKET_ABI,
        functionName: "sell",
        args: [isYes, parsed],
      });

      const forwardRequest = await autoSignForwardRequest(
        walletClient, account, wallet.address, marketAddress, sellCalldata, 800_000n,
      );

      const result = await submitToRelayer({ permit, forwardRequest });
      setTxHash(result.txHash);
      toast.success("Sell confirmed!", {
        action: { label: "View Transaction", onClick: () => window.open(explorerTxUrl(result.txHash), "_blank") },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sell failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return { executeSell, isLoading: isProcessing, txHash };
}

export function useGaslessClaim(marketAddress: `0x${string}`) {
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const claim = async () => {
    const wallet = getEmbeddedWallet();
    if (!wallet) {
      toast.error("Create a trading wallet first");
      return;
    }

    setIsLoading(true);
    setTxHash(undefined);

    try {
      toast.info("Claiming winnings...");
      const walletClient = getEmbeddedWalletClient(wallet);
      const account = getEmbeddedAccount(wallet);

      const claimCalldata = encodeFunctionData({
        abi: MARKET_ABI,
        functionName: "claim",
      });

      const forwardRequest = await autoSignForwardRequest(
        walletClient, account, wallet.address, marketAddress, claimCalldata, 300_000n,
      );

      const result = await submitToRelayer({ forwardRequest });
      setTxHash(result.txHash);
      toast.success("Winnings claimed!", {
        action: { label: "View Transaction", onClick: () => window.open(explorerTxUrl(result.txHash), "_blank") },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return { claim, isLoading, txHash };
}
