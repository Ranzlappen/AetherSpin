# Security & RGS Best Practices

AetherSpin separates **certified server math** from the **presentation layer**.
Getting this boundary right is the single most important security property of a
Stake Engine game.

## Golden rule: the client never decides outcomes

- **All randomness and all payouts are determined server-side** by the certified
  RGS using the uploaded math library (books + lookup tables). The frontend only
  _replays_ the outcome the server already committed to.
- The book a round resolves to, the `payoutMultiplier`, and the balance are
  **authoritative from the RGS**. The client must treat its local mock
  (`frontend/src/core/mockRgs.ts`) as a dev-only convenience and never as a
  source of truth in production.
- Never compute a win, RNG value, or balance on the client and send it to the
  server. The RGS ignores client-asserted outcomes by design.

## RGS communication

- Endpoints: `POST /wallet/authenticate`, `/wallet/play`, `/wallet/end-round`,
  `/wallet/balance`, `/bet/event`. Always over HTTPS.
- `sessionID`, `rgsUrl`, `currency`, and `lang` arrive as URL query params when
  Stake serves the game in its iframe. Validate and never log full session IDs.
- `authenticate` **before** any wallet call; handle `ERR_IS` (invalid session)
  and `ERR_ATE` (auth expired) by re-authenticating or surfacing a clean error.
- Always pair a `play` with an `end-round`. Resume an unfinished round reported
  by `authenticate` (the `round` field) instead of starting a new one.
- Convert amounts only through the shared helpers: API amounts are integers of
  `dollars * 1_000_000`. Never use floats for money on the wire.
- Treat every RGS response defensively: check `status.statusCode === "SUCCESS"`
  before acting; map error codes to user-facing messages; fail closed.

## Secrets & configuration

- The game frontend holds **no secrets**. There are no API keys in the bundle.
- Operator/session validation is the RGS's responsibility, not the client's.
- Do not commit `.env` files; `dist-stake/`, `math/engine/`, and generated
  `math/library/*` are git-ignored.

## Math integrity

- The math library is the certified artifact. Regenerate it deterministically
  (`generate_books.py` is seeded) and validate RTP before every submission.
- Ensure the buy-bonus is **not EV-positive for the player** — this is both a
  commercial and a compliance requirement. `math/tests/test_engine.py` guards it.

## Reporting a vulnerability

Please open a private security advisory or email the studio maintainers rather
than filing a public issue. Do not include exploit details in public channels.
