import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { KEEPER_PRIVATE_KEY, RPC_URL, CHAIN_ID } from "./config.js";

const hashkeyTestnet: Chain = {
  id: CHAIN_ID,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
};

export const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);

export const publicClient = createPublicClient({
  chain: hashkeyTestnet,
  transport: http(RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
    batch: true,
  }),
});

export const walletClient = createWalletClient({
  account,
  chain: hashkeyTestnet,
  transport: http(RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});

console.log(`[Keeper] Wallet address: ${account.address}`);
