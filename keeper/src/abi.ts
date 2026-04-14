// ABIs for SpeedMarketAMM and collateral token (MockUSDT)

export const speedMarketAbi = [
  // --- Owner/Keeper functions ---
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "asset", type: "string" },
      { name: "strikePrice", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "initialLiquidity", type: "uint256" },
    ],
    outputs: [{ name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveMarket",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcomeIsUp", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // --- View functions ---
  {
    type: "function",
    name: "getMarket",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      { name: "asset", type: "string" },
      { name: "strikePrice", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "resolved", type: "bool" },
      { name: "outcomeIsUp", type: "bool" },
      { name: "reserveUp", type: "uint256" },
      { name: "reserveDown", type: "uint256" },
      { name: "totalCollateral", type: "uint256" },
      { name: "totalLpShares", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextMarketId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lpBalances",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "provider", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // --- LP recovery ---
  {
    type: "function",
    name: "claim",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeLiquidity",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "shares", type: "uint256" },
    ],
    outputs: [{ name: "collateralOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export const collateralAbi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
