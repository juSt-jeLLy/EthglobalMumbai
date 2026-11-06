# World ID: Verified Human Callers

Plan B uses World ID **Proof of Human** as an optional anti-Sybil layer for
Caller Card publishers. It is separate from wallet signing:

- **World ID** proves one unique human has enrolled one Plan B caller wallet.
- **Wallet signature** proves that wallet authored each exact Caller Card and
  every later revision.
- **Public source verification** checks whether the referenced `planb:<id>`
  card appears at the claimed X URL.

World ID does not prove a person owns an X handle. Plan B must never make that
claim without a separate X OAuth/API identity flow.

## Flow

1. The caller connects an EVM wallet on `caller.html`.
2. The page requests an RP context from `POST /world/rp-context`.
3. The backend signs the request with the secret RP signing key and binds the
   World proof signal to `planb-caller:<lowercase-wallet>`.
4. IDKit shows a QR/deep link for World App and requests Proof of Human.
5. The caller signs a short enrollment message containing the World nonce with
   that same wallet, then the browser forwards the complete result and wallet
   signature to `POST /world/verify`.
6. The backend verifies the unmodified result at World, checks action,
   environment, World signal, wallet signature, and stores the action-scoped
   nullifier.
7. With `WORLD_REQUIRE_CALLER_VERIFICATION=true`, `POST /signals` rejects any
   Caller Card whose signer does not have that verified-human record.

The stored nullifier is scoped to this Plan B World action. It establishes
uniqueness for this app and action; it cannot be used to correlate a person
across unrelated apps.

## Developer Portal setup

1. Create an app in the [World Developer Portal](https://developer.world.org).
2. Enable World ID 4.0 and create the action `planb-verified-caller-v1` (or
   configure another action name consistently).
3. Copy the app ID, RP ID, and RP signing key into the backend environment.
   The signing key is a server secret and must never appear in the static page
   or extension.
4. For a local simulator rehearsal, set `WORLD_ENVIRONMENT=staging` and use
   the [World ID Simulator](https://simulator.worldcoin.org). For a live demo,
   set `WORLD_ENVIRONMENT=production` and use a real World ID proof.
5. After one successful proof, set
   `WORLD_REQUIRE_CALLER_VERIFICATION=true` to make it a publishing requirement.

```env
WORLD_APP_ID=app_...
WORLD_RP_ID=rp_...
WORLD_RP_SIGNING_KEY=...
WORLD_ACTION=planb-verified-caller-v1
WORLD_ENVIRONMENT=staging
WORLD_REQUIRE_CALLER_VERIFICATION=false
```

`WORLD_STAGING_TOKEN` is retained as an optional compatibility setting for
older Developer Portal staging windows. Current World ID documentation directs
developers to use the simulator with the `staging` environment and does not
document a generally required staging token. Leave it blank unless your
Developer Portal specifically issues one for your app.
