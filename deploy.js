#!/usr/bin/env node

// Deploy current schedule to ../247420/schedule.json
// Runs build, picks today's slots, writes flat schedule for the 247420 player

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WEEK_START = new Date('2025-10-11T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const OUTPUT = path.join(__dirname, '..', '247420', 'schedule.json');

function getCurrentWeek() {
    const elapsed = Date.now() - WEEK_START.getTime();
    return (Math.floor(elapsed / WEEK_MS) % 101) + 1;
}

function buildSchedule() {
    console.log('Building schedule...');
    execSync('node build_schedule.js', { cwd: __dirname, stdio: 'inherit' });
}

function loadWeek(weekNum) {
    const weekFile = path.join(__dirname, 'schedule_weeks', 'station_1', `week_${weekNum}.json`);
    if (!fs.existsSync(weekFile)) {
        console.error(`Week file not found: ${weekFile}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(weekFile, 'utf8'));
}

function buildDaySchedule(weekData, dayName) {
    const { v: lookup, s: slots } = weekData;
    const daySlots = slots.filter(s => s.d === dayName);

    daySlots.sort((a, b) => {
        const toSecs = t => {
            const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!m) return 0;
            let h = parseInt(m[1]), mins = parseInt(m[2]);
            const pm = m[3].toUpperCase() === 'PM';
            if (pm && h !== 12) h += 12;
            if (!pm && h === 12) h = 0;
            return h * 3600 + mins * 60;
        };
        return toSecs(a.t) - toSecs(b.t);
    });

    return daySlots.map(slot => {
        const vid = lookup[slot.v] || {};
        return {
            t: slot.t,
            v: slot.v,
            d: slot.du,
            title: vid.show ? `${vid.show} — ${vid.episode}` : slot.v,
            url: vid.u || ''
        };
    });
}

function run() {
    buildSchedule();

    const weekNum = getCurrentWeek();
    const today = DAYS[new Date().getDay()];
    console.log(`\nWeek ${weekNum}, deploying ${today}'s schedule...`);

    const weekData = loadWeek(weekNum);
    const schedule = buildDaySchedule(weekData, today);

    if (schedule.length === 0) {
        console.warn('No slots found for today — check build output');
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(schedule, null, 2));
    console.log(`Wrote ${schedule.length} slots to ${OUTPUT}`);
}

run();
