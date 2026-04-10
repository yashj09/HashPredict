import type { Abi } from "viem";
import factoryAbi from "./factory_abi.json";
import marketAbi from "./market_abi.json";
import usdtAbi from "./usdt_abi.json";
import erc20Abi from "./erc20_abi.json";

// Deploy addresses — update these after deployment
export const FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_FACTORY_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as `0x${string}`);

export const USDT_ADDRESS =
  (process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}`) ||
  ("0x0000000000000000000000000000000000000000" as `0x${string}`);

export const FACTORY_ABI = factoryAbi as unknown as Abi;
export const MARKET_ABI = marketAbi as unknown as Abi;
export const USDT_ABI = usdtAbi as unknown as Abi;
export const ERC20_ABI = erc20Abi as unknown as Abi;
