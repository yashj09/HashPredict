"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useSpeedLivePrices } from "@/hooks/useSpeedLivePrices";

function formatTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

export function SpeedPriceChart({
  asset,
  strikePrice,
}: {
  asset: string;
  strikePrice: bigint;
}) {
  const { snapshots, currentPrice } = useSpeedLivePrices(asset, 5000);
  const strike = Number(strikePrice) / 1e8;

  // Compute Y domain with padding around strike and prices
  const prices = snapshots.map((s) => s.price);
  const allValues = [...prices, strike];
  const minVal = allValues.length > 0 ? Math.min(...allValues) : strike * 0.999;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : strike * 1.001;
  const padding = (maxVal - minVal) * 0.15 || strike * 0.001;
  const yMin = minVal - padding;
  const yMax = maxVal + padding;

  const isAbove = currentPrice !== null && currentPrice > strike;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{asset} Price</h3>
        {currentPrice !== null && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Current</span>
            <span className={`text-sm font-bold ${isAbove ? "text-emerald-400" : "text-red-400"}`}>
              {formatPrice(currentPrice)}
            </span>
          </div>
        )}
      </div>

      {snapshots.length < 2 ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-6 h-6 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin mb-3" />
            <p className="text-zinc-500 text-sm">
              Collecting live price data...
            </p>
            <p className="text-zinc-600 text-xs mt-1">
              Strike: {formatPrice(strike)}
            </p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={snapshots}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`priceGrad-${asset}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isAbove ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isAbove ? "#10b981" : "#ef4444"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#52525b"
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v) => {
                if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
                return `$${v.toFixed(2)}`;
              }}
              stroke="#52525b"
              tick={{ fontSize: 10, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={65}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(value) => [formatPrice(Number(value)), asset]}
            />
            <ReferenceLine
              y={strike}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              strokeWidth={2}
              label={{
                value: `Strike ${formatPrice(strike)}`,
                position: "right",
                fill: "#f59e0b",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={isAbove ? "#10b981" : "#ef4444"}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: isAbove ? "#10b981" : "#ef4444", stroke: "#09090b", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
