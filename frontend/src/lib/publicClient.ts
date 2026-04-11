import { createPublicClient, http } from "viem";
import { hashkeyTestnet } from "./chains";

export const publicClient = createPublicClient({
  chain: hashkeyTestnet,
  transport: http("https://testnet.hsk.xyz"),
});
