"use client";

import { useState, useEffect, useRef } from "react";

const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

export interface PriceSnapshot {
  time: number; // unix seconds
  price: number;
}

/**
 * Accumulates live Pyth price snapshots every `interval` ms for a given asset.
 * Returns an array of { time, price } points for charting.
 */
export function useSpeedLivePrices(asset: string, interval = 5000) {
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const feedId = PYTH_FEED_IDS[asset.toUpperCase()];
  const snapshotsRef = useRef<PriceSnapshot[]>([]);

  useEffect(() => {
    if (!feedId) return;

    // Reset on asset change
    snapshotsRef.current = [];
    setSnapshots([]);
    setCurrentPrice(null);

    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`,
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const parsed = json.parsed?.[0]?.price;
        if (!parsed) return;

        const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
        const time = Math.floor(Date.now() / 1000);

        if (!cancelled) {
          setCurrentPrice(price);
          const point = { time, price };
          snapshotsRef.current = [...snapshotsRef.current, point];
          setSnapshots([...snapshotsRef.current]);
        }
      } catch {
        // Retry on next interval
      }
    }

    fetchPrice();
    const timer = setInterval(fetchPrice, interval);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [feedId, interval]);

  return { snapshots, currentPrice };
}
