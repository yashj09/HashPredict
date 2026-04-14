import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hashkeyTestnet } from "@/lib/chains";
import forwarderAbi from "@/lib/forwarder_abi.json";
import usdtAbi from "@/lib/usdt_abi.json";

const FORWARDER_ADDRESS = process.env.NEXT_PUBLIC_FORWARDER_ADDRESS as `0x${string}`;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

const publicClient = createPublicClient({
  chain: hashkeyTestnet,
  transport: http("https://testnet.hsk.xyz"),
});

function getRelayerWallet() {
  if (!RELAYER_PRIVATE_KEY) throw new Error("RELAYER_PRIVATE_KEY not configured");
  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  return createWalletClient({
    account,
    chain: hashkeyTestnet,
    transport: http("https://testnet.hsk.xyz"),
  });
}

interface PermitData {
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
  value: string;
  deadline: string;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

interface ForwardRequestData {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  gas: string;
  deadline: number;
  data: `0x${string}`;
  signature: `0x${string}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { permit, forwardRequest } = body as {
      permit?: PermitData;
      forwardRequest: ForwardRequestData;
    };

    if (!forwardRequest) {
      return Response.json({ error: "Missing forwardRequest" }, { status: 400 });
    }

    if (!FORWARDER_ADDRESS || FORWARDER_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return Response.json({ error: "Forwarder not configured" }, { status: 500 });
    }

    const wallet = getRelayerWallet();

    // Step 1: Submit permit if provided (gasless token approval)
    if (permit) {
      const permitData = encodeFunctionData({
        abi: usdtAbi,
        functionName: "permit",
        args: [
          permit.owner,
          permit.spender,
          BigInt(permit.value),
          BigInt(permit.deadline),
          permit.v,
          permit.r,
          permit.s,
        ],
      });

      const permitHash = await wallet.sendTransaction({
        to: permit.token,
        data: permitData,
        gas: 100_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: permitHash });
    }

    // Step 2: Execute the forwarded meta-transaction
    const executeData = encodeFunctionData({
      abi: forwarderAbi,
      functionName: "execute",
      args: [
        {
          from: forwardRequest.from,
          to: forwardRequest.to,
          value: BigInt(forwardRequest.value),
          gas: BigInt(forwardRequest.gas),
          deadline: Number(forwardRequest.deadline),
          data: forwardRequest.data,
          signature: forwardRequest.signature,
        },
      ],
    });

    const txHash = await wallet.sendTransaction({
      to: FORWARDER_ADDRESS,
      data: executeData,
      gas: 1_000_000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === "reverted") {
      return Response.json(
        { error: "Transaction reverted on-chain", txHash },
        { status: 400 },
      );
    }

    return Response.json({
      txHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Relay failed";
    console.error("Relay error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
