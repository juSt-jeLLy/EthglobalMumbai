# Plan B

Plan B is a Chrome extension that turns trading signals on X into editable, non-custodial order plans. Click **Make plan** on a tweet, review the Groq-generated draft, choose the size yourself, and sign a Definitive Flash entry plus optional stop/target protection from your wallet.

## What is implemented

- **Any-tweet parsing:** `POST /parse` sends untrusted tweet text to Groq using a strict JSON schema. The model can suggest only token, chain, side, entry type/price, stop, target, duration, confidence and ambiguity fields. It never chooses size or authorizes a trade.
- **Independent validation:** backend code resolves the asset through Flash `/search`, validates chain availability, compares prices with Flash's current price, checks stop/target direction, and rejects low-confidence or unclear posts.
- **Simple plan panel:** the normal view asks “How do I get in?” (market, limit, TWAP) and “How do I get out?” (stop + target or none). The original Flash order controls remain under **Advanced**.
- **Flash execution:** market, limit, TWAP/DCA, stop, stop-loss, take-profit, bracket, trailing-stop and trailing-stop-limit orders, including attached brackets and their second wallet signature.
- **Live asset coverage:** tokens are discovered from Flash at runtime across Ethereum, Base, Arbitrum, Optimism, Avalanche, BNB Chain, Polygon, HyperEVM, Ink, Monad, Plasma, Robinhood Chain, Arc and Solana.
- **Wallet-native signing:** EIP-712 and EIP-191 on EVM; Ed25519 and transaction signing on Solana. Service keys stay in the backend.
- **Social execution proof:** submitted plans are mapped to their tweet and author. A backend Flash Orders WebSocket updates plan state and card statistics for followers, target hits and stopped-out plans.
- **Order dashboard:** open, resolved and cancelled plans are visible inside X. Cancellation uses the canonical Flash cancel message and wallet signature; attached protection can be cancelled with the entry.
- **Share receipts:** resolved plans expose a pre-filled “Share receipt on X” action.
- **Caller Cards:** `plan-b-landing-page/caller.html` lets a caller validate and sign a structured plan. The generated tweet contains a `planb:<id>` reference that the extension recognizes as verified.
- **Pre-trade security gate:** Plan B combines Flash risk data, GoPlus token analysis and Honeypot sell simulation where supported. Critical findings hard-block buys; warnings require explicit acknowledgement.
- **Resilient discovery:** Flash `/search` remains primary. If an integrator key is temporarily ineligible for search, DEX Screener resolves the contract and decimals for drafting; Flash still validates the real quote before any wallet signature.

## Architecture

```text
X tweet
  └─ Make plan
      └─ extension/background.js
          └─ POST /parse
              ├─ Groq strict structured output
              └─ Definitive Flash asset validation

Reviewed plan
  └─ wallet setup + order signatures
      └─ Definitive Flash quote/order APIs
          └─ Flash Orders WebSocket
              └─ backend plan log → social proof + order dashboard
```

The backend stores order and social context, not private keys. The extension never receives `GROQ_API_KEY`, `DEFINITIVE_FLASH_API_KEY`, or an optional `GOPLUS_ACCESS_TOKEN`.

## Local setup

### Requirements

- Node.js 18+
- Chrome or another Chromium browser
- An injected EVM wallet such as MetaMask or Rabby and/or a Solana wallet such as Phantom

### Backend

Create `backend/.env` from `backend/.env.example` and set:

```env
DEFINITIVE_FLASH_API_KEY=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GOPLUS_ACCESS_TOKEN=       # optional; public checks work without it
```

Then run:

```bash
cd backend
npm install
node server.js
```

The API listens on `http://localhost:8000` by default. Set `EXTENSION_ID` after Chrome assigns a stable unpacked-extension ID to restrict CORS to that extension.

### Extension

```bash
cd extension
npm install
npm run build:solana
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the `extension` directory. Reload the extension and refresh X after code changes. Chrome Web Store submission is not required for local or hackathon use.

### Landing page and Caller Card

```bash
cd plan-b-landing-page
python3 -m http.server 4173
```

Open `http://localhost:4173`. The Caller Card uses the backend at `http://localhost:8000`.

## Important behavior

- Tweet text is untrusted data and cannot change the parser instructions.
- Position size is always entered by the user.
- No order is signed or submitted until the user clicks and approves the wallet request.
- First-time token approval can cost gas.
- Bought tokens must remain in the signing wallet while attached protection is active.
- Cancelling an entry does not automatically cancel its activated bracket, so the dashboard exposes both cancellations.

## Main files

| Area | Files |
|---|---|
| Groq parsing and Flash validation | `backend/parser.js` |
| Plan log and social outcomes | `backend/plans.js`, `backend/flash-stream.js` |
| Verified Caller Cards | `backend/signals.js`, `plan-b-landing-page/caller.html` |
| Backend routes and safety limits | `backend/server.js`, `backend/flash.js` |
| Tweet UI, execution and dashboard | `extension/x-ticker-swap.js` |
| Extension network proxy | `extension/background.js` |
| Wallet bridge | `extension/bridge.js` |
| Offline Flash specification | `docs/definitive-flash/openapi.json` |
