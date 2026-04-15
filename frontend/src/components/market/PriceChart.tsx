"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { usePriceHistory } from "@/hooks/usePriceHistory";

function formatDate(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PriceChart({
  marketAddress,
}: {
  marketAddress: `0x${string}`;
}) {
  const { data: priceHistory, isLoading, isError } = usePriceHistory(marketAddress);

  return (
    <div className="glass-card p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Price History</h3>

      {isError ? (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-slate-500 text-sm">Failed to load price history.</p>
        </div>
      ) : isLoading ? (
        <div className="h-[300px] skeleton" />
      ) : !priceHistory || priceHistory.length <= 1 ? (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-slate-500 text-sm">
            No trading activity yet.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={priceHistory}
            margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
          >
            <defs>
              <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatDate}
              stroke="#334155"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              stroke="#334155"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a0e1a",
                border: "1px solid rgba(20, 184, 166, 0.2)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(label) => formatDateTime(Number(label))}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, "YES"]}
            />
            <ReferenceLine
              y={50}
              stroke="#1e293b"
              strokeDasharray="3 3"
            />
            <Area
              type="monotone"
              dataKey="yesPrice"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#yesGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", stroke: "#0a0e1a" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
