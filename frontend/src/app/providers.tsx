"use client";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import { Toaster } from "sonner";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

function ChainFixer() {
  const { isConnected, connector } = useAccount();

  useEffect(() => {
    if (!isConnected || !connector) return;

    // Force MetaMask to use the correct RPC for chain 133
    // This fixes "Requested resource not available" errors when MetaMask
    // has a stale/broken RPC URL stored for the chain
    async function fixChainRpc() {
      try {
        const provider = await connector!.getProvider();
        await (provider as any).request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x85",
              chainName: "HashKey Chain Testnet",
              nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
              rpcUrls: ["https://testnet.hsk.xyz"],
              blockExplorerUrls: ["https://testnet-explorer.hsk.xyz"],
            },
          ],
        });
      } catch {
        // Chain already exists or user rejected — that's fine
      }
    }

    fixChainRpc();
  }, [isConnected, connector]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#6366f1",
            borderRadius: "medium",
          })}
        >
          <ChainFixer />
          {children}
          <Toaster theme="dark" position="bottom-right" richColors />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
