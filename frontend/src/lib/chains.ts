import { defineChain } from "viem";

export const hashkeyTestnet = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "HashKey EcoPoints",
    symbol: "HSK",
  },
  rpcUrls: {
    default: {
      http: ["https://testnet.hsk.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://testnet-explorer.hsk.xyz",
    },
  },
  testnet: true,
});

export const hashkeyMainnet = defineChain({
  id: 177,
  name: "HashKey Chain",
  nativeCurrency: {
    decimals: 18,
    name: "HashKey EcoPoints",
    symbol: "HSK",
  },
  rpcUrls: {
    default: {
      http: ["https://mainnet.hsk.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://hashkey.blockscout.com",
    },
  },
});
