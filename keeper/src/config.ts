import type { Address } from "viem";

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

export const KEEPER_PRIVATE_KEY = env("KEEPER_PRIVATE_KEY") as `0x${string}`;
export const RPC_URL = env("RPC_URL", "https://testnet.hsk.xyz");
export const CHAIN_ID = Number(env("CHAIN_ID", "133"));

export const SPEED_MARKET_ADDRESS = env("SPEED_MARKET_ADDRESS") as Address;
export const COLLATERAL_ADDRESS = env("COLLATERAL_ADDRESS") as Address;

export const PYTH_HERMES_URL = env("PYTH_HERMES_URL", "https://hermes.pyth.network");

export const SLOT_DURATION = Number(env("SLOT_DURATION", "900")); // 15 minutes
export const INITIAL_LIQUIDITY = BigInt(env("INITIAL_LIQUIDITY", "100000000")); // 100 USDT (6 decimals)

export const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

export const SPEED_ASSETS = Object.keys(PYTH_FEED_IDS);

export const HEALTH_PORT = Number(env("HEALTH_PORT", "3001"));
