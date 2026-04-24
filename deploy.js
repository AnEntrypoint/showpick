#!/usr/bin/env node

// Deploy schedule to ../247420/schedule.json
// Uses full pipeline when videos_stream.json has data, else fetches directly from archive.org

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const WEEK_START = new Date('2025-10-11T00:00:00Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const OUTPUT = path.join(__dirname, '..', '247420', 'schedule.json');

const DEAD_ZONES = [[0, 4], [10, 11]];

const FALLBACK_COLLECTIONS = [
    'Popeye_forPresident', 'popeye_patriotic_popeye', 'popeye_private_eye_popeye',
    'FLIP_FROG-FIDDLESTICKS', 'bb_snow_white', 'bb_minnie_the_moocher',
    'Popeye_Nearlyweds', 'Popeye_meetsSinbadtheSailor', 'the_cobweb_hotel',
    'SOLDIER', 'PopeyeAliBaba', 'popeye_big_bad_sinbad',
    'HowTheGrinchStoleChristmas_201812', 'popeye_shuteye_popeye',
    'popeye_i_dont_scare', 'popeye_taxi-turvey'
];

function get(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve(d));
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

async function fetchCollection(id) {
    const raw = await get(`https://archive.org/metadata/${id}`);
    const data = JSON.parse(raw);
    const titleArr = data.metadata?.title;
    const title = Array.isArray(titleArr) ? titleArr[0] : (titleArr || id);
    return (data.files || [])
        .filter(f => f.name?.toLowerCase().endsWith('.mp4') && !f.name.includes('.ia.mp4') && parseFloat(f.length || 0) > 60)
        .map(f => ({
            url: `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`,
            title,
            duration: Math.floor(parseFloat(f.length))
        }));
}

function fmt(secs) {
    const h = Math.floor(secs / 3600) % 24;
    const m = Math.floor((secs % 3600) / 60);
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dh}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function buildFlatSchedule(videos) {
    const schedule = [];
    let cursor = 0;
    let vi = 0;
    while (cursor < 86400) {
        const hour = Math.floor(cursor / 3600);
        const zone = DEAD_ZONES.find(([s, e]) => hour >= s && hour < e);
        if (zone) {
            const end = zone[1] * 3600;
            schedule.push({ t: fmt(cursor), v: 'static', d: end - cursor, title: 'Off Air — Static Screen' });
            cursor = end;
        } else {
            const vid = videos[vi % videos.length];
            vi++;
            const dur = Math.min(vid.duration, 86400 - cursor);
            schedule.push({ t: fmt(cursor), v: vid.url, d: dur, title: vid.title, url: vid.url });
            cursor += dur;
        }
    }
    return schedule;
}

function getCurrentWeek() {
    return (Math.floor((Date.now() - WEEK_START.getTime()) / WEEK_MS) % 101) + 1;
}

function buildFromPipeline() {
    console.log('Building from pipeline...');
    execSync('node build_schedule.js', { cwd: __dirname, stdio: 'inherit' });
    const weekNum = getCurrentWeek();
    const today = DAYS[new Date().getDay()];
    const weekFile = path.join(__dirname, 'schedule_weeks', 'station_1', `week_${weekNum}.json`);
    if (!fs.existsSync(weekFile)) return null;
    const { v: lookup, s: slots } = JSON.parse(fs.readFileSync(weekFile, 'utf8'));
    const toSecs = t => {
        const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!m) return 0;
        let h = parseInt(m[1]);
        const pm = m[3].toUpperCase() === 'PM';
        if (pm && h !== 12) h += 12;
        if (!pm && h === 12) h = 0;
        return h * 3600 + parseInt(m[2]) * 60;
    };
    return slots
        .filter(s => s.d === today)
        .sort((a, b) => toSecs(a.t) - toSecs(b.t))
        .map(slot => {
            const vid = lookup[slot.v] || {};
            return { t: slot.t, v: slot.v, d: slot.du, title: vid.show ? `${vid.show} — ${vid.episode}` : slot.v, url: vid.u || '' };
        });
}

async function buildFromArchive() {
    console.log('Fetching from archive.org...');
    const videos = [];
    for (const id of FALLBACK_COLLECTIONS) {
        try {
            const vids = await fetchCollection(id);
            videos.push(...vids.slice(0, 3));
            process.stdout.write('.');
        } catch (e) { process.stdout.write('x'); }
    }
    console.log(`\nFetched ${videos.length} videos`);
    return buildFlatSchedule(videos);
}

async function run() {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos_stream.json'), 'utf8'));
    let schedule;

    if (data.videos && data.videos.length > 0) {
        schedule = buildFromPipeline();
        if (!schedule || schedule.length === 0) {
            console.warn('Pipeline produced no slots, falling back to archive.org');
            schedule = await buildFromArchive();
        }
    } else {
        console.log('No preprocessed videos — fetching directly from archive.org');
        schedule = await buildFromArchive();
    }

    fs.writeFileSync(OUTPUT, JSON.stringify(schedule, null, 2));
    console.log(`Wrote ${schedule.length} slots to ${OUTPUT}`);
}

run().catch(e => { console.error(e); process.exit(1); });
