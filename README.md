# 420sched — Schedule Builder

Builds weekly TV schedules from archive.org video collections and deploys them to the 247420 player.

## Quick Start

```
npm run preprocess    # Fetch videos from archive.org → videos_stream.json
npm run build         # Build schedule_weeks/ from videos_stream.json
npm run deploy        # Build + deploy today's schedule to ../247420/schedule.json
npm run full-deploy   # Preprocess + deploy in one step
```

## Flow

```
archive.org → preprocess.js → videos_stream.json → build_schedule.js → schedule_weeks/station_N/week_N.json → deploy.js → ../247420/schedule.json
```

## Architecture

- `config.js` — all settings
- `preprocess.js` — fetches archive.org collections
- `build_schedule.js` — generates weekly schedule files
- `deploy.js` — converts today's week schedule to 247420 flat format
- `lib/` — data, video, schedule, station, preprocess, web modules

## Output Format

`schedule_weeks/station_N/week_N.json`:
```json
{ "v": { "<id>": { "show": "...", "u": "https://..." } }, "s": [...], "week": N }
```

`../247420/schedule.json` (deployed daily):
```json
[{ "t": "12:00 AM", "v": "<id>", "d": 1800, "title": "...", "url": "https://..." }]
```
