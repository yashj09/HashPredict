import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hashkeyTestnet } from "./chains";

export const config = getDefaultConfig({
  appName: "HashPredict",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [hashkeyTestnet],
  ssr: true,
});
