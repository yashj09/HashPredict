import { createWalletClient, http, type Account } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { hashkeyTestnet } from "./chains";

const STORAGE_KEY = "hashpredict_embedded_wallet";

export interface EmbeddedWallet {
  address: `0x${string}`;
  privateKey: `0x${string}`;
}

/** Get the stored embedded wallet, or null if none exists */
export function getEmbeddedWallet(): EmbeddedWallet | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as EmbeddedWallet;
  } catch {
    return null;
  }
}

/** Create a new embedded wallet and store it */
export function createEmbeddedWallet(): EmbeddedWallet {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const wallet: EmbeddedWallet = { address: account.address, privateKey };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
  return wallet;
}

/** Remove the embedded wallet from storage */
export function removeEmbeddedWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Get a viem Account object for signing */
export function getEmbeddedAccount(wallet: EmbeddedWallet): Account {
  return privateKeyToAccount(wallet.privateKey);
}

/** Get a viem WalletClient for the embedded wallet */
export function getEmbeddedWalletClient(wallet: EmbeddedWallet) {
  const account = privateKeyToAccount(wallet.privateKey);
  return createWalletClient({
    account,
    chain: hashkeyTestnet,
    transport: http("https://testnet.hsk.xyz"),
  });
}
