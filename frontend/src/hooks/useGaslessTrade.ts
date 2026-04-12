"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useReadContract } from "wagmi";
import { encodeFunctionData, parseUnits, maxUint256 } from "viem";
import { toast } from "sonner";
import { FORWARDER_ADDRESS, FORWARDER_ABI, MARKET_ABI, USDT_ABI } from "@/lib/contracts";
import { publicClient } from "@/lib/publicClient";

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

const CHAIN_ID = 133; // HashKey Chain Testnet

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

export function useGaslessBuy(
  marketAddress: `0x${string}`,
  collateralToken: `0x${string}`,
) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const executeBuy = async (isYes: boolean, amount: string, decimals: number = 6) => {
    if (!address || !walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    const parsed = parseUnits(amount, decimals);
    setIsProcessing(true);
    setTxHash(undefined);

    try {
      toast.info("Preparing gasless transaction...");

      // Check if market already has sufficient USDT allowance — skip permit if so
      const [forwarderNonce, currentAllowance] = await Promise.all([
        getForwarderNonce(address),
        getAllowance(collateralToken, address, marketAddress),
      ]);

      let permit: {
        token: `0x${string}`;
        owner: `0x${string}`;
        spender: `0x${string}`;
        value: string;
        deadline: string;
        v: number;
        r: `0x${string}`;
        s: `0x${string}`;
      } | undefined;

      if (currentAllowance < parsed) {
        // Need permit — approve maxUint256 so this is a one-time signature
        const [permitNonce, tokenName] = await Promise.all([
          getPermitNonce(collateralToken, address),
          getTokenName(collateralToken),
        ]);

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        toast.info("One-time approval needed — sign to approve USDT...");
        const permitSig = await walletClient.signTypedData({
          domain: {
            name: tokenName,
            version: "1",
            chainId: CHAIN_ID,
            verifyingContract: collateralToken,
          },
          types: PERMIT_TYPES,
          primaryType: "Permit",
          message: {
            owner: address,
            spender: marketAddress,
            value: maxUint256,
            nonce: permitNonce,
            deadline,
          },
        });

        const permitR = `0x${permitSig.slice(2, 66)}` as `0x${string}`;
        const permitS = `0x${permitSig.slice(66, 130)}` as `0x${string}`;
        const permitV = parseInt(permitSig.slice(130, 132), 16);

        permit = {
          token: collateralToken,
          owner: address,
          spender: marketAddress,
          value: maxUint256.toString(),
          deadline: deadline.toString(),
          v: permitV,
          r: permitR,
          s: permitS,
        };
      }

      // Sign the ForwardRequest for the buy call
      const buyCalldata = encodeFunctionData({
        abi: MARKET_ABI,
        functionName: "buy",
        args: [isYes, parsed],
      });

      const forwardDeadline = Math.floor(Date.now() / 1000) + 3600;

      toast.info("Sign to confirm trade...");
      const forwardSig = await walletClient.signTypedData({
        domain: {
          name: "HashPredictForwarder",
          version: "1",
          chainId: CHAIN_ID,
          verifyingContract: FORWARDER_ADDRESS,
        },
        types: FORWARD_REQUEST_TYPES,
        primaryType: "ForwardRequest",
        message: {
          from: address,
          to: marketAddress,
          value: 0n,
          gas: 800_000n,
          nonce: forwarderNonce,
          deadline: forwardDeadline,
          data: buyCalldata,
        },
      });

      toast.info("Submitting to relayer...");
      const result = await submitToRelayer({
        permit,
        forwardRequest: {
          from: address,
          to: marketAddress,
          value: "0",
          gas: "800000",
          deadline: forwardDeadline,
          data: buyCalldata,
          signature: forwardSig,
        },
      });

      setTxHash(result.txHash);
      toast.success("Gasless trade confirmed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gasless transaction failed";
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
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const executeSell = async (isYes: boolean, amount: string, decimals: number = 6) => {
    if (!address || !walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    const parsed = parseUnits(amount, decimals);
    setIsProcessing(true);
    setTxHash(undefined);

    try {
      toast.info("Preparing gasless sell...");

      const [forwarderNonce, currentAllowance] = await Promise.all([
        getForwarderNonce(address),
        getAllowance(tokenAddress, address, marketAddress),
      ]);

      let permit: {
        token: `0x${string}`;
        owner: `0x${string}`;
        spender: `0x${string}`;
        value: string;
        deadline: string;
        v: number;
        r: `0x${string}`;
        s: `0x${string}`;
      } | undefined;

      if (currentAllowance < parsed) {
        const [permitNonce, tokenName] = await Promise.all([
          getPermitNonce(tokenAddress, address),
          getTokenName(tokenAddress),
        ]);

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        toast.info("One-time approval needed — sign to approve token...");
        const permitSig = await walletClient.signTypedData({
          domain: {
            name: tokenName,
            version: "1",
            chainId: CHAIN_ID,
            verifyingContract: tokenAddress,
          },
          types: PERMIT_TYPES,
          primaryType: "Permit",
          message: {
            owner: address,
            spender: marketAddress,
            value: maxUint256,
            nonce: permitNonce,
            deadline,
          },
        });

        const permitR = `0x${permitSig.slice(2, 66)}` as `0x${string}`;
        const permitS = `0x${permitSig.slice(66, 130)}` as `0x${string}`;
        const permitV = parseInt(permitSig.slice(130, 132), 16);

        permit = {
          token: tokenAddress,
          owner: address,
          spender: marketAddress,
          value: maxUint256.toString(),
          deadline: deadline.toString(),
          v: permitV,
          r: permitR,
          s: permitS,
        };
      }

      const sellCalldata = encodeFunctionData({
        abi: MARKET_ABI,
        functionName: "sell",
        args: [isYes, parsed],
      });

      const forwardDeadline = Math.floor(Date.now() / 1000) + 3600;

      toast.info("Sign to confirm sell...");
      const forwardSig = await walletClient.signTypedData({
        domain: {
          name: "HashPredictForwarder",
          version: "1",
          chainId: CHAIN_ID,
          verifyingContract: FORWARDER_ADDRESS,
        },
        types: FORWARD_REQUEST_TYPES,
        primaryType: "ForwardRequest",
        message: {
          from: address,
          to: marketAddress,
          value: 0n,
          gas: 800_000n,
          nonce: forwarderNonce,
          deadline: forwardDeadline,
          data: sellCalldata,
        },
      });

      toast.info("Submitting to relayer...");
      const result = await submitToRelayer({
        permit,
        forwardRequest: {
          from: address,
          to: marketAddress,
          value: "0",
          gas: "800000",
          deadline: forwardDeadline,
          data: sellCalldata,
          signature: forwardSig,
        },
      });

      setTxHash(result.txHash);
      toast.success("Gasless sell confirmed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gasless sell failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return { executeSell, isLoading: isProcessing, txHash };
}

export function useGaslessClaim(marketAddress: `0x${string}`) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const claim = async () => {
    if (!address || !walletClient) {
      toast.error("Please connect your wallet");
      return;
    }

    setIsLoading(true);
    setTxHash(undefined);

    try {
      toast.info("Preparing gasless claim...");
      const forwarderNonce = await getForwarderNonce(address);

      const claimCalldata = encodeFunctionData({
        abi: MARKET_ABI,
        functionName: "claim",
      });

      const forwardDeadline = Math.floor(Date.now() / 1000) + 3600;

      toast.info("Sign the claim transaction...");
      const forwardSig = await walletClient.signTypedData({
        domain: {
          name: "HashPredictForwarder",
          version: "1",
          chainId: CHAIN_ID,
          verifyingContract: FORWARDER_ADDRESS,
        },
        types: FORWARD_REQUEST_TYPES,
        primaryType: "ForwardRequest",
        message: {
          from: address,
          to: marketAddress,
          value: 0n,
          gas: 300_000n,
          nonce: forwarderNonce,
          deadline: forwardDeadline,
          data: claimCalldata,
        },
      });

      toast.info("Submitting to relayer...");
      const result = await submitToRelayer({
        forwardRequest: {
          from: address,
          to: marketAddress,
          value: "0",
          gas: "300000",
          deadline: forwardDeadline,
          data: claimCalldata,
          signature: forwardSig,
        },
      });

      setTxHash(result.txHash);
      toast.success("Gasless claim confirmed!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gasless claim failed";
      toast.error(msg.length > 200 ? msg.slice(0, 200) + "..." : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return { claim, isLoading, txHash };
}
