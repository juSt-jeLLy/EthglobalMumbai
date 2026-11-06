# 🌐 Plan B

Plan B is a Chrome extension that turns X ticker cards into non-custodial trading panels. When a tweet mentions a supported cashtag (`$ETH`, `$UNI`, `$AERO`, …), Plan B lets you place a market or advanced order without leaving the timeline.

## Features ✨

- **Flash's live token catalog** 🔎: ticker symbols are resolved through Flash at runtime, including the canonical address, decimals, price, liquidity, logo, and risk flag on each network. There is no curated token allowlist to maintain.
- **Advanced orders on every documented Flash chain** ⚡: market, limit, TWAP/DCA schedules, stop, stop-loss, take-profit, bracket, trailing-stop and trailing-stop-limit orders on Ethereum, Base, Arbitrum, Optimism, Avalanche, BNB Chain, Polygon, HyperEVM, Ink, Monad, Plasma, Robinhood Chain, Arc, and Solana. DCA uses Flash TWAP buckets because the current API schema has no separate `dca` enum.
- **Token safety checks with Intercepta** 🛡️: before you buy, Plan B checks the token and the swap transaction with Intercepta. Tokens flagged as risky get a warning or are blocked, and you must confirm before continuing.
- **Non-custodial execution** 🔐: the extension uses the connected browser wallet for approvals and Flash order signatures. The backend holds the API key, never user funds or wallet keys.

## How It Works 🔧

```
X ticker card ──► x-ticker-swap.js (advanced-order panel)
                     │  wallet calls ──► bridge.js ──► EVM wallet / Solana wallet
                     ▼
                 background.js ──► backend (localhost:8000)
                                     ├─ /flash/*       Definitive Flash API proxy
                                     ├─ /intercepta/*  token and transaction checks
                                     └─ /kickbacks/*   World ID verification + author registry
```

- **`extension/`**: the Manifest V3 extension. `x-ticker-swap.js` injects the order panel and handles Flash quote/sign/submit flows; `bridge.js` runs in the page's main world to reach your wallet.
- **`backend/`**: a small Express server that keeps the API keys and the World ID signing key out of the extension. Verified authors are stored in `backend/data/kickbacks.json`.

## Definitive Flash integration ⚡

Every order goes through the [Definitive Flash API](https://flash.definitive.fi/docs). Flash supplies live asset discovery, the quote, required setup actions, EIP-712 or Ed25519 signing payloads, and managed onchain execution.

| What | Code |
|---|---|
| API proxy that keeps `DEFINITIVE_FLASH_API_KEY` server-side | [`backend/flash.js`](backend/flash.js) |
| Advanced-order request construction and validation | [`extension/x-ticker-swap.js`](extension/x-ticker-swap.js) |
| Quote → setup transaction → EIP-712/Ed25519 sign → submit → status flow | [`extension/x-ticker-swap.js`](extension/x-ticker-swap.js) |
| Offline API reference | [`docs/definitive-flash/openapi.json`](docs/definitive-flash/openapi.json) |

## Intercepta security checks 🛡️

People and autonomous agents scan X for alpha and act on cashtags fast, often on tokens someone is shilling. Plan B puts an Intercepta check between seeing a ticker and paying for it, so anything buying through a ticker card sees whether the token and the transaction are safe before money moves.

- **Token check when the panel opens.** Intercepta rates the token. `warn` shows the reasons in the panel, and `block` disables Buy (selling stays possible, so holders can get out).
- **Transaction simulation for setup actions.** Flash approval and native-wrap transactions are simulated before being sent. If Intercepta flags an action, it is held until the user picks **Cancel** or **Continue anyway**.

**Example:** real PEPE lives on Ethereum, but on Base a copycat also calls itself PEPE, and Intercepta flags it as a honeypot. Open the Buy panel on a `$PEPE` card: on Ethereum the check passes, on Base Buy is disabled.

Plan B currently attaches to ticker cards X renders, but the token behind each ticker is resolved from Flash's live catalog instead of a curated allowlist. Direct contract-address parsing from ordinary tweet text is the next parsing-layer milestone.

Where to find it:

| What | Code |
|---|---|
| API proxy that keeps the key on the server and caches token verdicts for 10 minutes | [`backend/intercepta.js`](backend/intercepta.js), routes at [`backend/server.js#L15-L16`](backend/server.js#L15-L16) |
| Extension background call to the proxy | [`extension/background.js#L22-L30`](extension/background.js#L22-L30) |
| Token risk check (`block` / `warn` / `info` and reasons) | [`extension/x-ticker-swap.js#L376-L385`](extension/x-ticker-swap.js#L376-L385) |
| Transaction simulation before signing | [`extension/x-ticker-swap.js#L390-L399`](extension/x-ticker-swap.js#L390-L399) |
| Blocked tokens disable Buy, and the verdict shown in the panel | [`extension/x-ticker-swap.js#L1133-L1160`](extension/x-ticker-swap.js#L1133-L1160) |
| Holding a flagged transaction until the user decides | [`extension/x-ticker-swap.js#L1217-L1232`](extension/x-ticker-swap.js#L1217-L1232) |
| Every transaction goes through the check before it's sent | [`extension/x-ticker-swap.js#L1236-L1246`](extension/x-ticker-swap.js#L1236-L1246) |

**Feedback on the Intercepta API**

- Token risk and transaction simulation return clear `action` values and readable detector descriptions, so we could show them to users without rewriting them.
- Token risk is on `/v2` and simulation on `/v1`, with different response shapes. One version would make the client simpler.
- Positive signals (`HIGH_REPUTATION_TOKEN`) come back in the same `detectors` list as risks, so we filter them out by code. A severity or polarity field would remove that guesswork.
- Transaction simulation is used where Intercepta supports the selected EVM chain. Solana displays Flash's asset risk signal and uses the wallet's native signing flow.

## World ID 🪪

Kickback authors prove with World ID (Proof of Human, IDKit v4) that they are one unique human, so one person can earn for only one X account. See [docs/world-id.md](docs/world-id.md) for why we chose this credential, the verification flow and its alternative paths, and our integration debrief.

## Requirements

- [Node (v18+)](https://nodejs.org/en/download/)
- Chrome (or another Chromium browser) with an EVM wallet such as MetaMask and/or a Solana wallet such as Phantom

## Quick start

```bash
git clone git@github.com:Scannty/eth-blinks.git
```

### Backend

1. Create `backend/.env` (see `.env.example`):
   - `DEFINITIVE_FLASH_API_KEY`: your key from the [Flash getting-started guide](https://flash.definitive.fi/docs/getting-started).
   - `INTERCEPTA_API_KEY`: from [Intercepta](https://intercepta.io).
   - `WORLD_*`: in the [World Developer Portal](https://developer.world.org), create an external app, enable World ID 4.0 and create the `earn-kickbacks` action. Use `staging` to test with the [World ID Simulator](https://simulator.worldcoin.org), or `production` for the real World App.

2. Install and run (port 8000, override with `PORT`):

```bash
cd backend/
npm install
node server.js
```

### Extension

1. Run `npm install && npm run build:solana` in `extension/` when rebuilding the bundled Solana transaction decoder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Open x.com and look for a ticker card with a **Buy** button.

After changing extension code, click the reload icon on the extension card and refresh X. The extension expects the backend at `http://localhost:8000` (`BACKEND_URL` in `background.js`).
