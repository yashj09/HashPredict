import { formatUnits } from "viem";

export function formatUSDT(amount: bigint): string {
  return parseFloat(formatUnits(amount, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatProbability(price: bigint): string {
  const pct = (Number(price) / 1e18) * 100;
  return pct.toFixed(1);
}

export function formatProbabilityNumber(price: bigint): number {
  return (Number(price) / 1e18) * 100;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function timeRemaining(endTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTimestamp - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
