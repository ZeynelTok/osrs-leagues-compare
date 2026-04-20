# OSRS Leagues Task Compare (MVP)

Small React tool to compare two RuneScape Leagues players by:
- skill levels
- task completion overlap and differences
- point totals and point delta
- breakdowns by region and tier

## Current MVP Scope

- Compares exactly 2 players.
- Uses a built-in task catalog parsed from `tasks_from_wiki.md` at app startup.
- Uses the shared `/api/player` route locally and on Vercel to fetch RuneScape Wiki data server-side.
- Supports tier points mapping:
  - easy = 10
  - medium = 30
  - hard = 80
  - elite = 200
  - master = 400

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite client and serves `/api/player` through Vite middleware.
`npm run start` runs the same local Vite setup for parity.

Build check:

```bash
npm run build
```

## How To Use

1. Enter Player A username.
2. Enter Player B username.
3. Click Compare.

## API Endpoint Shape

The shared API route fetches the RuneScape Wiki sync endpoint in this shape:

`https://sync.runescape.wiki/runelite/player/<username>/<league_id>`

Important fields used:
- `levels`
- `league_tasks`

## Config

- `REQUEST_TIMEOUT_MS` controls upstream timeout (default `8000`).
- `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS` control API rate limiting.
- `CACHE_TTL_MS` controls short-lived player response cache TTL.

## Notes

- Player fetches now go through the shared API route so the browser never talks to the wiki directly.
- If direct sync requests are rejected by network edge protections, the backend falls back to a mirror transport and still returns JSON to the frontend.
- Task metadata is no longer user-provided in the UI; it is bundled with the app.
