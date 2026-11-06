# Plan B — Build status

Last updated: 2026-11-07

## Product loop that is implemented

1. The X extension only offers a Plan B action for a signed `planb:` Caller Card or a post with both a token/contract mention and clear trading intent.
2. Groq converts untrusted text into a constrained plan draft. The backend—not the model—validates the asset, chain, price sanity and protection direction against Flash.
3. An explicit contract is looked up as that exact contract. A ticker/contract mismatch blocks trading; a ticker-only result is labelled `symbol_resolved`.
4. The extension opens an editable Flash order panel. The user provides size, can use the voice field for missing order facts, and signs from their own wallet.
5. Flash receives the signed advanced-order request. Market, limit, TWAP/DCA, stop, stop-loss, take-profit, bracket, trailing stop and trailing stop-limit paths are supported by the existing compiler.
6. The backend records submitted Flash orders and uses the Flash order stream for visible follower/outcome state.

## Social/accountability layer

- **Verified Caller Card:** a caller signs a canonical strategy message. The later X post is attached as source evidence by the extension without modifying that signed strategy.
- **Source attestation:** a linked post must contain the specific `planb:<id>` reference and is checked immediately against X’s public embed endpoint. A bounded backend worker rechecks attested sources every 15 minutes by default (`SOURCE_MONITOR_INTERVAL_MS` is configurable). The Passport distinguishes `browser_observed`, `public_verified`, `public_available_unverified`, `unavailable`, and `removed`; a public embed check never silently becomes identity proof.
- **Signal Passport:** stores text hash, public source, exact asset, contract-integrity result, Flash detection price, order terms, expiry, availability checks and one expiry mark-price direction result.
- **Append-only revisions:** a Caller Card signer can publish a separately signed strategy revision with a reason. Original Passport terms never change; Radar shows the newest revision and its explanation. A follower’s open Flash plan can also revise its limit price or its attached stop/target protection with a fresh wallet signature.
- **Flash execution receipts:** a follower record keeps quote ID, quote time, estimated price impact and fee data. The order dashboard shows available quote quality and supports wallet-signed limit and attached bracket stop/target updates through Flash's cancel-and-replace endpoint.
- **No fake combined trust score:** identity verification, historical signed-call outcomes, follower Flash outcomes, contract integrity and token safety remain separate concepts in the UI/data.
- **Caller record:** only signed Caller Cards count toward hit rate and median price-direction result. Parsed public posts can be observed but never improve a caller score.
- **Radar:** `GET /terminal` has distinct `verified` and `observed` feeds. Observed posts never count toward reputation and are labelled manual review; the signed feed supports state/order filters, swarm cards, Flash execution recommendations and a browser-local X-handle watchlist.
- **Evidence surfaces:** the landing app exposes Radar, Signal Passports, Caller Rankings, Outcomes, and Caller Card creation. Signal Passports display contract, capture price, expiry, source/verification status, text hash, settlement and follower outcomes; observed records remain visibly separate from signed Caller Cards.
- **Methodology gate:** caller records are `unscored`, `emerging`, or `established`; at least five expiry-scored signed Caller Cards are required before the hit rate is labelled established. Chain and order-type counts stay visible rather than becoming a synthetic trust score.
- **Local notifications:** after a follower enables alerts for a caller, the Chrome extension performs a one-minute local Radar check. It only notifies on newly seen, validated Caller Cards or new swarms; clicking an alert opens its source. This requires no X API or push provider.

## Important limits (intentional and visible)

- A Passport expiry result is a Flash mark-price direction check, not proof that a target or stop executed. Actual follower target/stop outcomes come from Flash order events.
- “Post removed” requires two consecutive public `404` source checks. An API/network problem stays `unavailable`.
- A production-grade PostgreSQL database is the required runtime store for plans, Signal Passports, caller subscriptions, and World verification records. Legacy JSON can be imported once with `npm run db:import-json`; it is never used as a runtime fallback.
- The app does not auto-sign, copy wallet balances, auto-execute a caller’s trade, or parse a user’s size from a post.
- The Flash search entitlement must be active for fully live asset discovery. The existing DEX metadata fallback is only for draft discovery; Flash remains the executor and final quote source.

## Demo route map

| Route | Purpose |
| --- | --- |
| `POST /parse` | Groq + server validation of a tweet or voice instruction |
| `POST /signals` | Creates a wallet-signed Caller Card |
| `POST /signals/:id/source` | Attaches the public X source after posting |
| `POST /signals/:id/revisions/message` / `POST /signals/:id/revisions` | Prepares and stores a caller-signed append-only strategy revision |
| `POST /signals/capture` | Stores an unsigned observed-signal Passport separately |
| `GET /signals/:id/passport` | Reads a Passport; `?refresh=availability` runs an on-demand public availability check |
| `GET /creators/:creator` | Caller record with signed-call statistics |
| `GET /terminal?scope=verified|observed` | Public Radar feed; signed Caller Cards or separately labelled observed posts |
| `GET /radar?funderAddress=…` | Wallet-specific followed-caller feed used by the extension |
