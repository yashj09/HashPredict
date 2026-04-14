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
 * Streams live Pyth prices via SSE (Server-Sent Events) for real-time chart data.
 * Falls back to HTTP polling if SSE fails.
 */
export function useSpeedLivePrices(asset: string) {
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const feedId = PYTH_FEED_IDS[asset.toUpperCase()];
  const snapshotsRef = useRef<PriceSnapshot[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!feedId) return;

    // Reset on asset change
    snapshotsRef.current = [];
    setSnapshots([]);
    setCurrentPrice(null);

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    function addPoint(price: number) {
      if (cancelled) return;
      const time = Math.floor(Date.now() / 1000);
      // Deduplicate — skip if same second as last point
      const last = snapshotsRef.current[snapshotsRef.current.length - 1];
      if (last && last.time === time) return;

      setCurrentPrice(price);
      const point = { time, price };
      snapshotsRef.current = [...snapshotsRef.current, point];
      setSnapshots([...snapshotsRef.current]);
    }

    // Try SSE streaming first
    function startSSE() {
      const url = `https://hermes.pyth.network/v2/updates/price/stream?ids[]=${feedId}&parsed=true&allow_unordered=true&benchmarks_only=false`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const parsed = data.parsed?.[0]?.price;
          if (!parsed) return;
          const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
          addPoint(price);
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        // SSE failed — close and fall back to polling
        es.close();
        eventSourceRef.current = null;
        if (!cancelled) startPolling();
      };
    }

    // Fallback: HTTP polling every 2s
    function startPolling() {
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
          addPoint(price);
        } catch {
          // retry on next interval
        }
      }
      fetchPrice();
      fallbackTimer = setInterval(fetchPrice, 2000);
    }

    startSSE();

    return () => {
      cancelled = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [feedId]);

  return { snapshots, currentPrice };
}
