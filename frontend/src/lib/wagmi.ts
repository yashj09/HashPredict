import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { hashkeyTestnet } from "./chains";

export const config = getDefaultConfig({
  appName: "HashPredict",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [hashkeyTestnet],
  transports: {
    [hashkeyTestnet.id]: http("https://testnet.hsk.xyz"),
  },
  ssr: true,
});
