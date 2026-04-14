"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { useSpeedLivePrices } from "@/hooks/useSpeedLivePrices";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────

function formatTime(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPrice(price: number): string {
  if (price >= 1000)
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return price.toFixed(4);
}

function useCountdown(expiry: number) {
  const [remaining, setRemaining] = useState(
    expiry - Math.floor(Date.now() / 1000),
  );
  useEffect(() => {
    const t = setInterval(
      () => setRemaining(expiry - Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [expiry]);
  return remaining;
}

// Custom tooltip matching Polymarket dark style
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  const price = payload[0].value as number;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-zinc-500 mb-0.5">{formatTime(label)}</p>
      <p className="text-sm font-bold text-white">${formatPrice(price)}</p>
    </div>
  );
}

// Custom strike label rendered at the right edge
function StrikeLabel({ viewBox, strike }: { viewBox?: any; strike: number }) {
  if (!viewBox) return null;
  const { x, y, width } = viewBox;
  return (
    <g>
      <rect
        x={(x ?? 0) + (width ?? 0) - 70}
        y={(y ?? 0) - 12}
        width={66}
        height={24}
        rx={6}
        fill="#27272a"
        stroke="#f59e0b"
        strokeWidth={1}
      />
      <text
        x={(x ?? 0) + (width ?? 0) - 37}
        y={(y ?? 0) + 4}
        textAnchor="middle"
        fill="#f59e0b"
        fontSize={10}
        fontWeight={700}
      >
        Target
      </text>
    </g>
  );
}

// ─── Main Component ─────────────────────────────────────

export function SpeedPriceChart({
  asset,
  strikePrice,
  expiry,
  resolved,
  outcomeIsUp,
}: {
  asset: string;
  strikePrice: bigint;
  expiry: number;
  resolved?: boolean;
  outcomeIsUp?: boolean;
}) {
  const { snapshots, currentPrice } = useSpeedLivePrices(asset);
  const strike = Number(strikePrice) / 1e8;
  const remaining = useCountdown(expiry);

  const isAbove = currentPrice !== null && currentPrice > strike;
  const diff =
    currentPrice !== null ? Math.abs(currentPrice - strike) : null;

  // Y-axis domain: tight around strike & prices for dramatic effect
  const { yMin, yMax } = useMemo(() => {
    const prices = snapshots.map((s) => s.price);
    const all = [...prices, strike];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const range = hi - lo || strike * 0.002;
    const pad = range * 0.2;
    return { yMin: lo - pad, yMax: hi + pad };
  }, [snapshots, strike]);

  // Format countdown as MM:SS
  const mins = Math.max(0, Math.floor(remaining / 60));
  const secs = Math.max(0, remaining % 60);
  const timerColor =
    remaining > 300
      ? "text-emerald-400"
      : remaining > 60
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      {/* ── Header (Polymarket-style) ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          {/* Left: title + date */}
          <div>
            <h3 className="text-base font-bold text-white">
              {asset} Up or Down &ndash; 15 Minutes
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              {new Date(expiry * 1000 - 900_000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              ,{" "}
              {new Date(expiry * 1000 - 900_000).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              &ndash;
              {new Date(expiry * 1000).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Right: countdown */}
          {!resolved && remaining > 0 && (
            <div className="text-right">
              <div className={cn("flex items-baseline gap-1", timerColor)}>
                <span className="text-2xl font-black tabular-nums">
                  {mins.toString().padStart(2, "0")}
                </span>
                <span className="text-xs font-medium opacity-70">MIN</span>
                <span className="text-2xl font-black tabular-nums ml-1">
                  {secs.toString().padStart(2, "0")}
                </span>
                <span className="text-xs font-medium opacity-70">SEC</span>
              </div>
            </div>
          )}
          {resolved && (
            <span
              className={cn(
                "text-sm font-bold px-3 py-1 rounded-full",
                outcomeIsUp
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400",
              )}
            >
              {outcomeIsUp ? "UP" : "DOWN"}
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-end gap-6 mt-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">
              Price To Beat
            </p>
            <p className="text-xl font-bold text-white tabular-nums">
              ${formatPrice(strike)}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Current Price
              </p>
              {diff !== null && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    isAbove
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400",
                  )}
                >
                  {isAbove ? "+" : "-"}${formatPrice(diff)}
                </span>
              )}
            </div>
            {currentPrice !== null ? (
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  isAbove ? "text-emerald-400" : "text-red-400",
                )}
              >
                ${formatPrice(currentPrice)}
              </p>
            ) : (
              <p className="text-xl font-bold text-zinc-600">&mdash;</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="px-2 pb-3">
        {snapshots.length < 2 ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block w-5 h-5 border-2 border-zinc-700 border-t-amber-500 rounded-full animate-spin mb-2" />
              <p className="text-zinc-500 text-xs">
                Streaming live price&hellip;
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={snapshots}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id={`areaFill-${asset}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={isAbove ? "#10b981" : "#ef4444"}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor={isAbove ? "#10b981" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                stroke="#3f3f46"
                tick={{ fontSize: 10, fill: "#52525b" }}
                axisLine={false}
                tickLine={false}
                minTickGap={60}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v) => `$${formatPrice(v)}`}
                stroke="#3f3f46"
                tick={{ fontSize: 10, fill: "#52525b" }}
                axisLine={false}
                tickLine={false}
                width={75}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={strike}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={<StrikeLabel strike={strike} />}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isAbove ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill={`url(#areaFill-${asset})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: isAbove ? "#10b981" : "#ef4444",
                  stroke: "#09090b",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
