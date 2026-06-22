# Game Design Document — &lt;Game Name&gt;

> Reusable GDD template for an AetherSpin / Stake Engine title. Copy this file to
> `docs/<game-id>-design.md` and fill it in. The numbers here must match
> `shared/games/<game-id>/game-definition.json` (the single source of truth). See
> `docs/novaforged-design.md` for a worked example.

|                  |                                             |
| ---------------- | ------------------------------------------- |
| **Game id**      | `<game-id>`                                 |
| **Display name** | &lt;Game Name&gt;                           |
| **Version**      | 0.1.0                                       |
| **Studio**       | AetherSpin                                  |
| **Status**       | Concept / In development / Submitted / Live |

---

## 1. Theme & concept

- **Theme:** &lt;e.g. neon-cosmic, mythological, …&gt;
- **One-line pitch:** &lt;the hook in a sentence&gt;
- **Tone & fantasy:** &lt;what the player feels&gt;
- **References / inspiration:** &lt;optional&gt;

## 2. Math model

| Property                   | Value                                    |
| -------------------------- | ---------------------------------------- |
| Engine type                | `lines` / `ways` / `cluster` / `scatter` |
| Grid                       | &lt;reels&gt; × &lt;rows&gt;             |
| Paylines / ways            | &lt;count&gt;                            |
| RTP target                 | &lt;e.g. 96.5%&gt;                       |
| Volatility                 | low / medium / high / very-high          |
| Win cap                    | &lt;e.g. 5000×&gt;                       |
| Hit frequency (target)     | &lt;%&gt;                                |
| Feature frequency (target) | &lt;1 in N&gt;                           |
| Bet modes                  | base (1.0×) [, bonus (Nx)]               |

## 3. Symbols

| Id  | Name            | Kind    | Color | Substitutes |
| --- | --------------- | ------- | ----- | ----------- |
| W   | &lt;Wild&gt;    | wild    | `#…`  | …           |
| S   | &lt;Scatter&gt; | scatter | `#…`  | —           |
| H1  | …               | high    | `#…`  | —           |
| …   | …               | …       | …     | …           |
| L1  | …               | low     | `#…`  | —           |

## 4. Paytable

Payouts are per-line multipliers for 3 / 4 / 5 of a kind.

| Symbol | 3   | 4   | 5   |
| ------ | --- | --- | --- |
| W      |     |     |     |
| H1     |     |     |     |
| …      |     |     |     |
| L1     |     |     |     |

**Scatter pays:** 3 → &lt;x&gt;, 4 → &lt;x&gt;, 5 → &lt;x&gt; (anywhere on the board).

## 5. Paylines / win definition

- **Count:** &lt;N&gt;
- **Direction:** left-aligned / both ways / cluster
- **Wild substitution:** &lt;rules&gt;
- (List or illustrate the line patterns — each is a `[row,…]` over the reels.)

## 6. Features

For each feature: trigger, behaviour, parameters, and how it reads in the definition.

### Free spins

- **Trigger:** &lt;N&gt; scatters
- **Awards:** 3 → &lt;x&gt;, 4 → &lt;x&gt;, 5 → &lt;x&gt;
- **Retrigger:** yes / no
- **Multiplier ladder:** start / step / max
- **`winScale`:** &lt;tuning factor&gt;

### Multiplier wilds

- **Applies in:** base / free
- **Values & weights:** &lt;[…] @ […]&gt;

### Expanding wilds

- **Applies in:** base / free
- **Behaviour:** &lt;which reels expand and when&gt;

### Bonus buy

- **Mode:** &lt;mode name&gt;
- **Cost:** &lt;N&gt;× base bet
- **Note:** must not be player-EV-positive

## 7. RTP & volatility targets

- **RTP:** &lt;target&gt; — base and (if applicable) bonus both on target.
- **Volatility rationale:** &lt;why the chosen class; strip composition strategy&gt;
- **Distribution shape:** &lt;expected win-band histogram in broad terms&gt;
- **Validation plan:** `validate_rtp.py` tolerance, sample sizes, optimizer knobs.

## 8. Art direction

- **Palette:** &lt;colors&gt;
- **Symbol style:** &lt;rendering style&gt;
- **Background / scenes:** base vs feature
- **VFX:** wins, big wins, feature transitions, win-cap
- **Asset strategy:** atlases, resolution, animation format

## 9. Sound direction

- **Music:** base loop, feature loop
- **SFX:** spin/stop, win tiers, ladder step, feature trigger/end, win-cap stinger
- **Mix & mute behaviour**

## 10. UX

- **Controls:** spin, bet selector, autoplay, bonus buy, paytable/rules
- **HUD:** balance, bet, win display, free-spins indicator (spins left, multiplier)
- **Onboarding / rules clarity**
- **Performance budget:** 60 FPS target

## 11. Compliance & responsible gaming

- Jurisdictional requirements
- Responsible-gaming affordances (reality checks, session reminders, help links)
- Required disclosures
- Certification artifacts (PAR sheet, RTP documentation)

## 12. Open questions / risks

- &lt;list&gt;
