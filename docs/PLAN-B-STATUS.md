# Plan B — Build status

Last updated: 2026-11-06

## Product loop that is implemented

1. The X extension only offers a Plan B action for a signed `planb:` Caller Card or a post with both a token/contract mention and clear trading intent.
2. Groq converts untrusted text into a constrained plan draft. The backend—not the model—validates the asset, chain, price sanity and protection direction against Flash.
3. An explicit contract is looked up as that exact contract. A ticker/contract mismatch blocks trading; a ticker-only result is labelled `symbol_resolved`.
4. The extension opens an editable Flash order panel. The user provides size, can use the voice field for missing order facts, and signs from their own wallet.
5. Flash receives the signed advanced-order request. Market, limit, TWAP/DCA, stop, stop-loss, take-profit, bracket, trailing stop and trailing stop-limit paths are supported by the existing compiler.
6. The backend records submitted Flash orders and uses the Flash order stream for visible follower/outcome state.

## Social/accountability layer

- **Verified Caller Card:** a caller signs a canonical strategy message. The later X post is attached as source evidence by the extension without modifying that signed strategy.
- **Signal Passport:** stores text hash, public source, exact asset, contract-integrity result, Flash detection price, order terms, expiry, availability checks and one expiry mark-price direction result.
- **No fake combined trust score:** identity verification, historical signed-call outcomes, follower Flash outcomes, contract integrity and token safety remain separate concepts in the UI/data.
- **Caller record:** only signed Caller Cards count toward hit rate and median price-direction result. Parsed public posts can be observed but never improve a caller score.
- **Radar:** `GET /terminal` provides verified Caller Cards with state filters, advanced-order type filters, swarm cards and Flash execution recommendations. The landing-page Radar terminal consumes it.

## Important limits (intentional and visible)

- A Passport expiry result is a Flash mark-price direction check, not proof that a target or stop executed. Actual follower target/stop outcomes come from Flash order events.
- “Post removed” requires two consecutive public `404` source checks. An API/network problem stays `unavailable`.
- Local `backend/data/*.json` is demo storage. It is not durable, authenticated multi-user storage or a cryptographic public ledger.
- The app does not auto-sign, copy wallet balances, auto-execute a caller’s trade, or parse a user’s size from a post.
- The Flash search entitlement must be active for fully live asset discovery. The existing DEX metadata fallback is only for draft discovery; Flash remains the executor and final quote source.

## Demo route map

| Route | Purpose |
| --- | --- |
| `POST /parse` | Groq + server validation of a tweet or voice instruction |
| `POST /signals` | Creates a wallet-signed Caller Card |
| `POST /signals/:id/source` | Attaches the public X source after posting |
| `POST /signals/capture` | Stores an unsigned observed-signal Passport separately |
| `GET /signals/:id/passport` | Reads a Passport; `?refresh=availability` runs an on-demand public availability check |
| `GET /creators/:creator` | Caller record with signed-call statistics |
| `GET /terminal` | Public Radar feed of signed Caller Cards |
| `GET /radar?funderAddress=…` | Wallet-specific followed-caller feed used by the extension |
