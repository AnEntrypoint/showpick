# Agents Guide

## Commands
- `npm run preprocess` - Fetch shows from web and create videos_stream.json
- `npm run build` - Build schedules from videos_stream.json
- `npm run full` - Run preprocess then build

## Flow
Web Search → preprocess.js → videos_stream.json → build_schedule.js → schedule_weeks/station_*/week_*.json

## Code Style
- Pure Node.js, no TypeScript, no build tools
- CommonJS imports: `const fs = require('fs')`
- No comments in code
- Functions: camelCase (`load`, `generate`)
- Constants: UPPER_SNAKE_CASE (`CONFIG`, `WEEK_DIR`)
- No semicolons optional, but be consistent (this codebase uses them)
- Early returns for guard clauses
- No fallbacks/mocks/simulations - ground truth only

## Architecture
- Convention over configuration: Standard patterns in lib/
- Configuration over code: All settings in config.js
- Dynamic station count based on content volume
- Modular: Separate concerns (data, video, schedule, station, preprocess, web)
- 168 slots per week (24h × 7 days)
- Duration thresholds: Short (<20min), Medium (20-55min), Long (>55min)
- Output: schedule_weeks/station_N/week_N.json

## Web Preprocessing
- Searches archive.org for video collections
- Categories: cartoon_animation, comedy_series, vintage_cartoons, english_dubbed, anime_english
- Inclusive English detection: Accepts dubbed/subtitled content even with foreign indicators
- Supports .mp4, .avi, .mov, .mkv formats
- Minimum 60 seconds duration
- Rate limiting and retry logic
- No collection or total limits
- Integrated streaming-video-finder from pubvid repository