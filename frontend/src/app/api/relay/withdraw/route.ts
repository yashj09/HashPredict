import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hashkeyTestnet } from "@/lib/chains";
import usdtAbi from "@/lib/usdt_abi.json";

const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`;
const FORWARDER_ADDRESS = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS as `0x${string}`;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

const publicClient = createPublicClient({
  chain: hashkeyTestnet,
  transport: http("https://testnet.hsk.xyz"),
});

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

export async function POST(request: Request) {
  try {
    const { embeddedWalletPrivateKey, to, amount } = await request.json();

    if (!embeddedWalletPrivateKey || !to || !amount) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create the embedded wallet account to sign the permit
    const embeddedAccount = privateKeyToAccount(embeddedWalletPrivateKey as `0x${string}`);
    const embeddedWalletClient = createWalletClient({
      account: embeddedAccount,
      chain: hashkeyTestnet,
      transport: http("https://testnet.hsk.xyz"),
    });

    // Create relayer wallet (pays gas)
    const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);
    const relayerWallet = createWalletClient({
      account: relayerAccount,
      chain: hashkeyTestnet,
      transport: http("https://testnet.hsk.xyz"),
    });

    const parsedAmount = BigInt(amount);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Get permit nonce and token name
    const [nonce, tokenName] = await Promise.all([
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: usdtAbi,
        functionName: "nonces",
        args: [embeddedAccount.address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: [{ type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" }],
        functionName: "name",
      }) as Promise<string>,
    ]);

    // Embedded wallet signs a permit allowing the relayer to spend its USDT
    const permitSig = await embeddedWalletClient.signTypedData({
      domain: {
        name: tokenName,
        version: "1",
        chainId: 133,
        verifyingContract: USDT_ADDRESS,
      },
      types: PERMIT_TYPES,
      primaryType: "Permit",
      message: {
        owner: embeddedAccount.address,
        spender: relayerAccount.address,
        value: parsedAmount,
        nonce,
        deadline,
      },
    });

    const r = `0x${permitSig.slice(2, 66)}` as `0x${string}`;
    const s = `0x${permitSig.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(permitSig.slice(130, 132), 16);

    // Relayer submits the permit on-chain
    const permitData = encodeFunctionData({
      abi: usdtAbi,
      functionName: "permit",
      args: [embeddedAccount.address, relayerAccount.address, parsedAmount, deadline, v, r, s],
    });

    const permitHash = await relayerWallet.sendTransaction({
      to: USDT_ADDRESS,
      data: permitData,
      gas: 100_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: permitHash });

    // Relayer calls transferFrom to move USDT from embedded wallet to main wallet
    const transferData = encodeFunctionData({
      abi: usdtAbi,
      functionName: "transferFrom",
      args: [embeddedAccount.address, to, parsedAmount],
    });

    const txHash = await relayerWallet.sendTransaction({
      to: USDT_ADDRESS,
      data: transferData,
      gas: 100_000n,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return Response.json({ txHash, status: "success" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Withdraw failed";
    console.error("Withdraw relay error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
