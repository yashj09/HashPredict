import { NextRequest, NextResponse } from "next/server";

const SUPRA_TESTNET_API = "https://rpc-testnet-dora-2.supra.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pair_indexes } = body;

    if (!Array.isArray(pair_indexes) || pair_indexes.length === 0) {
      return NextResponse.json({ error: "pair_indexes required" }, { status: 400 });
    }

    const resp = await fetch(`${SUPRA_TESTNET_API}/get_proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pair_indexes, chain_type: "evm" }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `SUPRA API error: ${resp.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
