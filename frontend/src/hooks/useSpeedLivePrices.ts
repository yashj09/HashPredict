"use client";

import { useSyncExternalStore, useCallback } from "react";

const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

export interface PriceSnapshot {
  time: number; // unix seconds
  price: number;
}

// ─── sessionStorage persistence ─────────────────────────

const STORAGE_PREFIX = "speed-prices-";
const SAVE_INTERVAL = 3_000; // flush to storage every 3s

function storageKey(asset: string) {
  return `${STORAGE_PREFIX}${asset}`;
}

function loadFromStorage(asset: string): PriceSnapshot[] {
  try {
    const raw = sessionStorage.getItem(storageKey(asset));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PriceSnapshot[];
    // Discard points older than 20 minutes
    const cutoff = Math.floor(Date.now() / 1000) - 1200;
    return parsed.filter((p) => p.time > cutoff);
  } catch {
    return [];
  }
}

function saveToStorage(asset: string, snapshots: PriceSnapshot[]) {
  try {
    // Only save last 600 points to keep storage small
    const toSave = snapshots.slice(-600);
    sessionStorage.setItem(storageKey(asset), JSON.stringify(toSave));
  } catch {
    // storage full or unavailable — ignore
  }
}

// ─── Pyth benchmark backfill ────────────────────────────
// On cold start (no cache), fetch recent historical prices
// from Pyth benchmarks to seed the chart.

async function fetchBenchmarkBackfill(
  feedId: string,
  durationSec: number,
  intervalSec: number,
): Promise<PriceSnapshot[]> {
  const now = Math.floor(Date.now() / 1000);
  const timestamps: number[] = [];

  for (let t = now - durationSec; t < now; t += intervalSec) {
    timestamps.push(t);
  }

  // Fetch in parallel batches of 10 to avoid overwhelming the API
  const points: PriceSnapshot[] = [];
  const batchSize = 10;

  for (let i = 0; i < timestamps.length; i += batchSize) {
    const batch = timestamps.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (ts) => {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/${ts}?ids[]=${feedId}&parsed=true`,
        );
        if (!res.ok) return null;
        const json = await res.json();
        const parsed = json.parsed?.[0]?.price;
        if (!parsed) return null;
        const price =
          Number(parsed.price) * Math.pow(10, Number(parsed.expo));
        const publishTime = Number(parsed.publish_time);
        return { time: publishTime, price } as PriceSnapshot;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        points.push(r.value);
      }
    }
  }

  return points.sort((a, b) => a.time - b.time);
}

// ─── Module-level singleton per asset ───────────────────

interface AssetStream {
  snapshots: PriceSnapshot[];
  currentPrice: number | null;
  listeners: Set<() => void>;
  eventSource: EventSource | null;
  fallbackTimer: ReturnType<typeof setInterval> | null;
  saveTimer: ReturnType<typeof setInterval> | null;
  refCount: number;
  backfillDone: boolean;
}

const streams = new Map<string, AssetStream>();
const MAX_SNAPSHOTS = 900;

function notify(stream: AssetStream) {
  for (const cb of stream.listeners) cb();
}

function addPoint(stream: AssetStream, asset: string, price: number) {
  const time = Math.floor(Date.now() / 1000);
  const last = stream.snapshots[stream.snapshots.length - 1];

  if (last && last.time === time) {
    // Same second — just update current price
    if (stream.currentPrice !== price) {
      stream.currentPrice = price;
      notify(stream);
    }
    return;
  }

  stream.currentPrice = price;
  stream.snapshots = [
    ...stream.snapshots.slice(-MAX_SNAPSHOTS + 1),
    { time, price },
  ];
  notify(stream);
}

function getOrCreateStream(asset: string): AssetStream {
  const key = asset.toUpperCase();
  const existing = streams.get(key);
  if (existing) return existing;

  const feedId = PYTH_FEED_IDS[key];
  if (!feedId) {
    const inert: AssetStream = {
      snapshots: [],
      currentPrice: null,
      listeners: new Set(),
      eventSource: null,
      fallbackTimer: null,
      saveTimer: null,
      refCount: 0,
      backfillDone: true,
    };
    streams.set(key, inert);
    return inert;
  }

  // 1. Seed from sessionStorage (survives page reloads)
  const cached = loadFromStorage(key);

  const stream: AssetStream = {
    snapshots: cached,
    currentPrice: cached.length > 0 ? cached[cached.length - 1].price : null,
    listeners: new Set(),
    eventSource: null,
    fallbackTimer: null,
    saveTimer: null,
    refCount: 0,
    backfillDone: cached.length > 0, // skip backfill if we have cached data
  };
  streams.set(key, stream);

  // 2. If no cache, backfill from Pyth benchmarks (last 10 min, every 30s = ~20 requests)
  if (!stream.backfillDone) {
    stream.backfillDone = true; // prevent double backfill
    fetchBenchmarkBackfill(feedId, 600, 30)
      .then((points) => {
        if (points.length > 0 && stream.snapshots.length < 5) {
          // Only use backfill if SSE hasn't already filled enough data
          const merged = [...points];
          // Append any live points that arrived during backfill
          for (const s of stream.snapshots) {
            if (!merged.some((m) => m.time === s.time)) {
              merged.push(s);
            }
          }
          merged.sort((a, b) => a.time - b.time);
          stream.snapshots = merged.slice(-MAX_SNAPSHOTS);
          stream.currentPrice =
            stream.snapshots[stream.snapshots.length - 1]?.price ?? null;
          notify(stream);
        }
      })
      .catch(() => {
        // backfill failed — SSE will fill in live data
      });
  }

  // 3. Start SSE for live streaming
  function startSSE() {
    const url = `https://hermes.pyth.network/v2/updates/price/stream?ids[]=${feedId}&parsed=true&allow_unordered=true&benchmarks_only=false`;
    const es = new EventSource(url);
    stream.eventSource = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const parsed = data.parsed?.[0]?.price;
        if (!parsed) return;
        const price =
          Number(parsed.price) * Math.pow(10, Number(parsed.expo));
        addPoint(stream, key, price);
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      stream.eventSource = null;
      startPolling();
    };
  }

  function startPolling() {
    async function fetchPrice() {
      try {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        const parsed = json.parsed?.[0]?.price;
        if (!parsed) return;
        const price =
          Number(parsed.price) * Math.pow(10, Number(parsed.expo));
        addPoint(stream, key, price);
      } catch {
        // retry next interval
      }
    }
    fetchPrice();
    stream.fallbackTimer = setInterval(fetchPrice, 2000);
  }

  // 4. Periodically flush to sessionStorage
  stream.saveTimer = setInterval(() => {
    saveToStorage(key, stream.snapshots);
  }, SAVE_INTERVAL);

  startSSE();
  return stream;
}

function stopStream(asset: string) {
  const key = asset.toUpperCase();
  const stream = streams.get(key);
  if (!stream) return;

  // Save final state before teardown
  saveToStorage(key, stream.snapshots);

  if (stream.eventSource) {
    stream.eventSource.close();
    stream.eventSource = null;
  }
  if (stream.fallbackTimer) {
    clearInterval(stream.fallbackTimer);
    stream.fallbackTimer = null;
  }
  if (stream.saveTimer) {
    clearInterval(stream.saveTimer);
    stream.saveTimer = null;
  }
  streams.delete(key);
}

// ─── React hook ─────────────────────────────────────────

export function useSpeedLivePrices(asset: string) {
  const key = asset.toUpperCase();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const stream = getOrCreateStream(key);
      stream.refCount++;
      stream.listeners.add(onStoreChange);

      return () => {
        stream.listeners.delete(onStoreChange);
        stream.refCount--;

        // Delay teardown to survive route transitions
        setTimeout(() => {
          if (stream.refCount <= 0) {
            stopStream(key);
          }
        }, 30_000);
      };
    },
    [key],
  );

  const getSnapshots = useCallback(() => {
    return streams.get(key)?.snapshots ?? [];
  }, [key]);

  const getCurrentPrice = useCallback(() => {
    return streams.get(key)?.currentPrice ?? null;
  }, [key]);

  const snapshots = useSyncExternalStore(subscribe, getSnapshots, () => []);
  const currentPrice = useSyncExternalStore(
    subscribe,
    getCurrentPrice,
    () => null,
  );

  return { snapshots, currentPrice };
}
