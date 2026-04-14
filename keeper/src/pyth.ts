import { PYTH_HERMES_URL } from "./config.js";

interface PythPriceResult {
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

/**
 * Fetch the latest price for a given Pyth feed ID.
 * Uses the Hermes REST API v2.
 */
export async function getCurrentPrice(feedId: string): Promise<PythPriceResult> {
  const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pyth Hermes error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const parsed = data.parsed?.[0]?.price;
  if (!parsed) {
    throw new Error(`No price data for feed ${feedId}`);
  }
  const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
  return {
    price,
    confidence: Number(parsed.conf) * Math.pow(10, Number(parsed.expo)),
    expo: Number(parsed.expo),
    publishTime: Number(parsed.publish_time),
  };
}

/**
 * Fetch the price at a specific timestamp (for settlement).
 * Uses Pyth Benchmarks via Hermes.
 */
export async function getSettlementPrice(
  feedId: string,
  targetTimestamp: number,
): Promise<PythPriceResult> {
  const url = `${PYTH_HERMES_URL}/v2/updates/price/${targetTimestamp}?ids[]=${feedId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Pyth Benchmarks error ${res.status} for ts=${targetTimestamp}: ${await res.text()}`,
    );
  }
  const data = await res.json();
  const parsed = data.parsed?.[0]?.price;
  if (!parsed) {
    throw new Error(`No benchmark price for feed ${feedId} at ts=${targetTimestamp}`);
  }
  const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
  return {
    price,
    confidence: Number(parsed.conf) * Math.pow(10, Number(parsed.expo)),
    expo: Number(parsed.expo),
    publishTime: Number(parsed.publish_time),
  };
}
