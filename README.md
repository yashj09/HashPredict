<p align="center">
  <h1 align="center">HashPredict</h1>
  <p align="center">
    <strong>On-chain prediction markets & 15-minute speed markets on HashKey Chain</strong>
  </p>
  <p align="center">
    <a href="https://hashpredict.xyz">Live Demo</a> &nbsp;|&nbsp;
    <a href="https://testnet-explorer.hsk.xyz">HashKey Explorer</a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/HashKey_Chain-Testnet-blue?style=flat-square" alt="HashKey Chain" />
    <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity" alt="Solidity" />
    <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Foundry-Built-orange?style=flat-square" alt="Foundry" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</p>

## HashKey Chain Horizon Hackathon

HashPredict is built for the **HashKey Chain Horizon Hackathon**. It demonstrates a full-stack prediction market platform deployed entirely on HashKey Chain Testnet, showcasing:

- **DeFi innovation** — CPMM-based binary options with automated market making
- **Gasless UX** — ERC-2771 meta-transactions so users never pay gas
- **Real-time infrastructure** — Automated keeper bot + Pyth oracle streaming
- **Production readiness** — End-to-end trading, resolution, and settlement


## Live Demo

**[https://hashpredict.xyz](https://hashpredict.xyz)**

[Demo Video](https://youtu.be/_pMVtzJschs) 

> Connect a wallet to HashKey Chain Testnet (Chain ID 133). Use the Faucet page to get test USDT, then trade on any market.


## Screenshots

<img width="1502" height="857" alt="Screenshot 2026-04-15 at 8 52 44 PM" src="https://github.com/user-attachments/assets/8880bad0-b656-45b8-94d5-20bab98d81e3" />

<img width="1100" height="853" alt="Screenshot 2026-04-15 at 8 54 02 PM" src="https://github.com/user-attachments/assets/a901688b-45da-444b-9e55-3571f3e0556e" />


## What is HashPredict?

HashPredict is a decentralized prediction market platform where users bet on the outcome of real-world events using USDT on HashKey Chain.

It offers two types of markets:

1. **Prediction Markets** — Long-term binary markets (e.g., "Will BTC hit $100,000 by June 2026?") with YES/NO outcome tokens and CPMM pricing
2. **Speed Markets** — 60-minute binary options on live crypto prices (BTC, ETH, SOL). Predict whether the price goes UP or DOWN from the strike price. New markets are created automatically every 60 minutes by a keeper bot.

All trades are gasless through an embedded wallet and ERC-2771 relayer — no MetaMask popups, no gas fees.

## How It Works

### Prediction Markets

```
1. Browse Markets     →  Pick a market (e.g., "Will BTC hit $100k?")
2. Buy YES or NO      →  Spend USDT to buy outcome tokens via CPMM
3. Wait for Result    →  Oracle resolves the market after deadline
4. Claim Winnings     →  Winners redeem tokens 1:1 for USDT
```

### Speed Markets (60-min Binary Options)

```
1. Pick an Asset      →  BTC, ETH, or SOL
2. See Strike Price   →  Current Pyth oracle price at market creation
3. Buy UP or DOWN     →  Predict if price goes above or below strike
4. Auto-Resolution    →  Keeper bot resolves after 60 minutes using Pyth
5. Claim if You Won   →  Winners get ~1.87x payout
```

### Gasless Trading Flow

```
User creates embedded wallet (localStorage)
  → Signs EIP-2612 permit (approve USDT)
  → Signs EIP-712 ForwardRequest (trade)
  → Relayer submits both on-chain
  → User pays $0 gas
```


## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HashKey Chain Testnet                     │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  MarketFactory   │  │ SpeedMarketAMM   │  │  MockUSDT  │  │
│  │  + Prediction    │  │ (monolithic,     │  │  (6 dec,   │  │
│  │    Market (each) │  │  all markets     │  │   EIP-2612 │  │
│  │  + OutcomeToken  │  │  in one contract)│  │   permit)  │  │
│  └────────┬────────┘  └───────┬──────────┘  └─────┬──────┘  │
│           │                   │                    │          │
│           └───────────────────┼────────────────────┘          │
│                               │                               │
│              ┌────────────────┴──────────────┐               │
│              │     ERC2771Forwarder          │               │
│              │     (gasless meta-tx relay)    │               │
│              └────────────────┬──────────────┘               │
└───────────────────────────────┼───────────────────────────────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
          ┌──────┴──────┐ ┌────┴─────┐ ┌──────┴──────┐
          │  Frontend   │ │  Keeper  │ │  Relayer    │
          │  (Next.js)  │ │  Bot     │ │  (API route)│
          │             │ │          │ │             │
          │ - Markets   │ │ - Create │ │ - Execute   │
          │ - Speed     │ │   slots  │ │   meta-tx   │
          │ - Trade     │ │ - Resolve│ │ - Permit    │
          │ - Portfolio │ │ - Recycle│ │   relay     │
          │ - Charts    │ │   LP     │ │             │
          └─────────────┘ └──────────┘ └─────────────┘
                                │
                         ┌──────┴──────┐
                         │ Pyth Hermes │
                         │ (price      │
                         │  oracle)    │
                         └─────────────┘
```


## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Smart Contracts** | Solidity + OpenZeppelin | 0.8.24 |
| **Contract Tooling** | Foundry (forge, cast) | Latest |
| **Frontend** | Next.js + React | 16.2.3 / 19.2.4 |
| **Blockchain Interaction** | wagmi + viem | 3.6.1 / 2.47.12 |
| **Wallet Connect** | RainbowKit | 2.2.10 |
| **Charts** | Recharts | 3.8.1 |
| **Keeper Bot** | Node.js + viem + node-cron | - |
| **Price Oracle** | Pyth Network (Hermes API + SSE) | - |
| **Chain** | HashKey Chain Testnet | Chain ID 133 |
| **Styling** | Tailwind CSS v4 | 4.x |


## Smart Contracts

All contracts are deployed on **HashKey Chain Testnet**:

| Contract | Address | Purpose |
|---|---|---|
| **MarketFactory** | `0x04D068D15cfe5F75103a0345e267C876411FcE91` | Creates and tracks prediction markets |
| **SpeedMarketAMM** | `0x108695f4B62d8964A06e1aaDA65FB3317737b2ac` | Monolithic speed market with CPMM |
| **MockUSDT** | `0x8065Fec351216Fbd636dc3216884A2eDbBdE1bE2` | ERC-20 collateral token (6 decimals, EIP-2612) |
| **ERC2771Forwarder** | `0x8844fF945204c986c78b4Fe6d942a1C7797f76c5` | Gasless meta-transaction relay |
| **SupraResolver** | `0xfdB2eC399c9Fb0a1b815B3B1229D4b9806D602b4` | Oracle-based market resolution |

### Key Design Decisions

- **CPMM (Constant Product Market Maker)**: `k = reserveYes * reserveNo` for binary option pricing with 2% fee
- **Monolithic SpeedMarketAMM**: All speed markets in one contract via `mapping(uint256 => SpeedMarket)` — cheaper than deploying per-market contracts for 60-min lifespan
- **Internal balance tracking**: Speed markets use `upBalances[marketId][user]` instead of ERC-20 outcome tokens — saves gas for short-lived markets
- **ERC-2771 gasless**: `_msgSender()` throughout for meta-transaction support via trusted forwarder


## Key Features

- **Binary Prediction Markets** — YES/NO markets with CPMM automated market making
- **60-Minute Speed Markets** — Real-time binary options on BTC/ETH/SOL with live Pyth price feeds
- **Gasless Trading** — Embedded wallet + ERC-2771 forwarder + EIP-2612 permits = zero gas for users
- **Automated Keeper Bot** — Creates new speed markets every 60 min, resolves expired ones using Pyth settlement prices, recycles liquidity
- **Live Price Charts** — Real-time SSE streaming from Pyth with Polymarket-style chart UI
- **On-chain Leaderboard** — Rankings computed from actual Buy/Sell/Claim events across all markets
- **Portfolio Tracking** — View all positions across prediction and speed markets with claim support
- **Cyberpunk UI** — Glassmorphism, neon glow effects, animated floating elements


## Setup & Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Foundry](https://getfoundry.sh/) (forge, cast)
- A wallet with HSK on HashKey Chain Testnet

### 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/HashKey-Chain-Horizon-Hackathon.git
cd HashKey-Chain-Horizon-Hackathon
```

### 2. Deploy Contracts

```bash
cd contracts
forge install
forge build

# Deploy (set your private key)
export PRIVATE_KEY=0x...
forge script script/DeployAll.s.sol --rpc-url https://testnet.hsk.xyz --broadcast
forge script script/DeploySpeedMarket.s.sol --rpc-url https://testnet.hsk.xyz --broadcast
```

### 3. Configure Environment

```bash
# Frontend
cp frontend/.env.local.example frontend/.env.local
# Update contract addresses in .env.local

# Keeper
cp keeper/.env.example keeper/.env
# Update KEEPER_PRIVATE_KEY, SPEED_MARKET_ADDRESS, etc.
```

### 4. Start Keeper Bot

```bash
cd keeper
npm install
npm run dev
# Logs: Creating BTC slot... Creating ETH slot... Creating SOL slot...
```

### 5. Start Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 6. Get Test USDT

Visit `/faucet` in the app or:

```bash
cast send 0x8065Fec351216Fbd636dc3216884A2eDbBdE1bE2 "faucet(uint256)" 10000000000 \
  --rpc-url https://testnet.hsk.xyz --private-key $PRIVATE_KEY
```


## Project Structure

```
HashKey-Chain-Horizon-Hackathon/
├── contracts/              # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── MarketFactory.sol
│   │   ├── PredictionMarket.sol
│   │   ├── SpeedMarketAMM.sol
│   │   ├── OutcomeToken.sol
│   │   ├── MockUSDT.sol
│   │   └── SupraResolver.sol
│   └── script/             # Deployment scripts
├── frontend/               # Next.js 16 web app
│   ├── src/app/            # Pages (markets, speed, portfolio, etc.)
│   ├── src/components/     # React components
│   ├── src/hooks/          # Custom hooks (wagmi, Pyth, trade)
│   └── src/lib/            # Utilities, ABIs, contract config
├── keeper/                 # Automated keeper bot
│   └── src/
│       ├── jobs/           # createSlot, resolveSlots, recycleLiquidity
│       ├── monitoring/     # Health check server
│       └── index.ts        # Cron scheduler
└── README.md
```

## License

MIT
