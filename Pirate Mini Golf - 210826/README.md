# Pirate Mini Golf

A nine-hole pirate mini golf scene for Decentraland, SDK7.

## Getting it running

```
npm install
npm start
```

Two things about this scene are not the SDK7 default, and both will waste
somebody's afternoon if they are not known up front.

### It runs on the Multiplayer Server

`scene.json` sets `authoritativeMultiplayer: true`, so the scene's code runs in
two places: in every player's client, and once more headlessly on a server.
`src/index.ts` branches on `isServer()` at the top of `main()` — the server
keeps the ledger and nothing else, and never builds the physics world, the
characters or the HUD.

The preview starts a local server automatically. Without it there is no ledger,
so the Pixel Points balance stays blank and nothing persists.

`npm run server-logs` tails the deployed server. It needs your wallet listed in
`scene.json` under `logsPermissions`.

### The SDK is pinned to a branch build

```
"@dcl/sdk": "7.26.1-32239895147.commit-3c77d90"
```

That is the `auth-server` branch, not `latest`, because `@dcl/sdk/server` and
`Storage.player` only exist there. **Pinned exactly on purpose** — a caret on a
prerelease resolves to the highest 7.x, which is a different build with none of
this in it, and the failure looks like `Cannot find module '@dcl/sdk/server'`.

`npm run upgrade-sdk` stays on the branch. Do not run `npm install @dcl/sdk@latest`.

## How it is put together

Physics is cannon-es, client-side, set up in `src/index.ts`. Everything else
lives in `src/golf/`:

| | |
|---|---|
| `game.ts` | the rules: hole, strokes, holing out, lost balls, moving to the next tee |
| `course.ts` | the nine holes, plus the practice green and the secret hole, as data |
| `aim.ts` `swing.ts` `club.ts` | aiming, the meter, and the putter |
| `hud.tsx` | all screen UI |
| `npc.ts` | characters you can talk to, as AvatarShapes with dialogue trees |
| `quests.ts` | quests as rows of data |
| `shop.ts` | the catalogue, and what a player owns |
| `points.ts` | the client's view of the ledger — holds no truth |
| `ledger.ts` | **server only.** Balances, purchases, quest progress, in `Storage.player` |
| `room.ts` | the message definitions both ends share |

### The rule worth knowing

**The client never names an amount.** It sends a finished card, or an item id,
or a quest id — and the server prices everything from the same tables the scene
draws from, then answers with the whole ledger rather than a delta. So there is
nothing on the client to keep in step, and nothing it can inflate.

The honest limit: the golf runs client-side, so the server sees a *result*, not
a round. It checks the card is well formed and rate-limits how often one can be
banked. Genuine authority would mean moving cannon onto the server.

## Adding things

**A quest** is a row in `QUESTS` in `quests.ts` — a `counts` predicate over
`QuestEvent`, a target, a reward, and the lines the character says. The reward
price is read off that same row by the ledger, so there is no second place to
keep in step. If the giver already hands quests out, there is no wiring at all.

**Shop stock** is a row in `CATALOGUE` in `shop.ts`. Clubs currently all point
at the one putter model — give an item its own `model` when the art lands.

Clubs are cosmetic on purpose. The nine are scored and the card goes on a
leaderboard; a club you can buy that hits straighter is a leaderboard nobody
trusts. `power` and `forgiveness` exist on the item type, both 1 on everything,
if that is ever wanted.

## Coordinates

Collision data in `src/collisionData/` is baked into play space. The mapping
from a .glb's own coordinates is:

```
play = (entity.x - local.x, entity.y + local.y, entity.z + local.z)
```

Mirrored in x. Every hole, the ramp and the practice green were derived this
way and checked against the collision mesh — re-derive rather than nudging by
hand if the export frame changes.
