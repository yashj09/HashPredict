"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useAccount } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";
import { Toaster } from "sonner";
import "@rainbow-me/rainbowkit/styles.css";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
      },
    },
  });
}

function ChainFixer() {
  const { isConnected, connector } = useAccount();

  useEffect(() => {
    if (!isConnected || !connector) return;

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
  const [queryClient] = useState(makeQueryClient);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#14b8a6",
            borderRadius: "medium",
          })}
        >
          {mounted && <ChainFixer />}
          {children}
          <Toaster theme="dark" position="bottom-right" richColors />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
