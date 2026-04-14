"use client";

import { useState, useEffect } from "react";

const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

interface PythPrice {
  price: number;
  confidence: number;
  publishTime: number;
}

export function usePythPrice(asset: string) {
  const [data, setData] = useState<PythPrice | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const feedId = PYTH_FEED_IDS[asset.toUpperCase()];
    if (!feedId) return;

    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`,
        );
        if (!res.ok) throw new Error(`Pyth error ${res.status}`);
        const json = await res.json();
        const parsed = json.parsed?.[0]?.price;
        if (!parsed || cancelled) return;

        const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
        setData({
          price,
          confidence: Number(parsed.conf) * Math.pow(10, Number(parsed.expo)),
          publishTime: Number(parsed.publish_time),
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 5_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset]);

  return { data, error };
}

export function usePythPrices(assets: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (assets.length === 0) return;

    let cancelled = false;

    async function fetchAll() {
      const ids = assets
        .map((a) => PYTH_FEED_IDS[a.toUpperCase()])
        .filter(Boolean);
      if (ids.length === 0) return;

      const params = ids.map((id) => `ids[]=${id}`).join("&");
      try {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/latest?${params}`,
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();

        const newPrices: Record<string, number> = {};
        for (let i = 0; i < assets.length; i++) {
          const parsed = json.parsed?.[i]?.price;
          if (parsed) {
            newPrices[assets[i].toUpperCase()] =
              Number(parsed.price) * Math.pow(10, Number(parsed.expo));
          }
        }
        if (!cancelled) setPrices(newPrices);
      } catch {
        // Silently retry on next interval
      }
    }

    fetchAll();
    const interval = setInterval(fetchAll, 5_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [assets.join(",")]);

  return prices;
}
