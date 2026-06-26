#!/usr/bin/env node

// Deploy schedule to ../247420/schedule.json
// Emits the correct UTC week + UTC day as a flat seconds-based entry list.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WEEK_START = new Date('2025-10-11T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const OUTPUT = path.join(__dirname, '..', '247420', 'schedule.json');

function getCurrentWeek() {
    return (Math.floor((Date.now() - WEEK_START.getTime()) / WEEK_MS) % 101) + 1;
}

function getUtcDay() {
    const dow = new Date().getUTCDay();
    return DAYS[(dow + 6) % 7];
}

function buildFromPipeline() {
    console.log('Building from pipeline...');
    execSync('node build_schedule.js', { cwd: __dirname, stdio: 'inherit' });
    const weekNum = getCurrentWeek();
    const today = getUtcDay();
    const weekFile = path.join(__dirname, 'schedule_weeks', 'station_1', `week_${weekNum}.json`);
    if (!fs.existsSync(weekFile)) {
        console.error(`week_${weekNum}.json missing - build did not produce the current week (insufficient corpus). No deploy.`);
        return null;
    }
    const { v: lookup, s: slots } = JSON.parse(fs.readFileSync(weekFile, 'utf8'));
    return slots
        .filter(s => s.day === today)
        .sort((a, b) => a.t - b.t)
        .map(slot => {
            const vid = lookup[slot.v] || {};
            const title = slot.title || (vid.show ? `${vid.show} - ${vid.episode}` : slot.v);
            const entry = { t: slot.t, v: slot.v, d: slot.d, title, url: vid.u || '', kind: slot.kind };
            if (slot.seek != null) entry.seek = slot.seek;
            if (slot.span != null) entry.span = slot.span;
            return entry;
        });
}

function run() {
    const schedule = buildFromPipeline();
    if (!schedule || schedule.length === 0) {
        console.error('No slots for current UTC week/day - aborting deploy (no fallback).');
        process.exit(1);
    }
    fs.writeFileSync(OUTPUT, JSON.stringify(schedule, null, 2));
    console.log(`Wrote ${schedule.length} entries (week ${getCurrentWeek()}, ${getUtcDay()}) to ${OUTPUT}`);
}

run();
