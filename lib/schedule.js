const CONFIG = require('../config');
const { makeRng, shuffleWith, intBetween } = require('./rng');

const SLOT = CONFIG.slots.slotSeconds;
const DAY_SLOTS = 24;
const DAY_SECONDS = SLOT * DAY_SLOTS;

function seededOrder(category, label) {
    const rng = makeRng(`${CONFIG.station.scheduleStart}:order:${label}`);
    return shuffleWith(rng, category);
}

function slotType(hour) {
    if (hour === 0) return 'movie';
    if (hour === 12) return 'clip_block';
    if (hour >= CONFIG.patterns.morning.start && hour <= CONFIG.patterns.morning.end) return 'clip_block';
    if (hour >= CONFIG.patterns.primeTime.start && hour <= CONFIG.patterns.primeTime.end) return 'movie';
    return 'single';
}

function rotateStart(pool, weekNumber, label) {
    if (!pool.length) return 0;
    const rng = makeRng(`${CONFIG.station.scheduleStart}:rotate:${label}:${weekNumber}`);
    return intBetween(rng, 0, pool.length - 1);
}

function takeUnused(pool, cursor, used) {
    if (!pool.length) return null;
    let scanned = 0;
    while (scanned < pool.length) {
        const v = pool[cursor.i % pool.length];
        cursor.i++;
        scanned++;
        if (!used.has(v.individual_id)) {
            used.add(v.individual_id);
            return v;
        }
    }
    return null;
}

function emitClipBlock(entries, dayStart, slotStart, shortPool, shortCursor, used) {
    let t = slotStart;
    const limit = slotStart + SLOT;
    let count = 0;
    while (t < limit && count < CONFIG.slots.clipBlock.maxClips) {
        const v = takeUnused(shortPool, shortCursor, used);
        if (!v) break;
        const dur = Math.min(v.duration_seconds, limit - t);
        entries.push({ t: Math.round(dayStart + t), v: v.individual_id, d: Math.round(dur), kind: 'show', title: v.collection_title });
        t += v.duration_seconds;
        count++;
    }
    return t > slotStart;
}

function emitSingleWithAds(entries, dayStart, slotStart, show, adPool, adRng, used) {
    const limit = slotStart + SLOT;
    const showDur = show.duration_seconds;
    if (showDur >= SLOT) {
        entries.push({ t: dayStart + slotStart, v: show.individual_id, d: SLOT, kind: 'show', title: show.collection_title });
        return true;
    }
    const fillNeeded = SLOT - showDur;
    const breaks = intBetween(adRng, CONFIG.slots.adBreaks.min, CONFIG.slots.adBreaks.max);
    const ads = [];
    let adTotal = 0;
    for (let i = 0; i < breaks; i++) {
        const ad = adPool[Math.floor(adRng() * adPool.length)];
        if (!ad) break;
        ads.push(ad);
        adTotal += ad.duration_seconds;
    }
    if (ads.length === 0) {
        entries.push({ t: dayStart + slotStart, v: show.individual_id, d: SLOT, kind: 'show', title: show.collection_title });
        return true;
    }
    const segCount = ads.length + 1;
    const segLen = showDur / segCount;
    let t = slotStart;
    let resume = 0;
    for (let i = 0; i < segCount; i++) {
        const thisSeg = (i === segCount - 1) ? (showDur - resume) : segLen;
        entries.push({ t: Math.round(dayStart + t), v: show.individual_id, d: Math.round(thisSeg), kind: 'segment', seek: Math.round(resume), title: show.collection_title });
        t += thisSeg;
        resume += thisSeg;
        if (i < ads.length) {
            const ad = ads[i];
            const adShare = fillNeeded / ads.length;
            entries.push({ t: Math.round(dayStart + t), v: ad.individual_id, d: Math.round(adShare), kind: 'ad', title: ad.collection_title });
            t += adShare;
        }
    }
    return true;
}

function emitMovie(entries, dayStart, slotStart, longPool, longCursor, used, slotsLeftInDay) {
    const movie = takeUnused(longPool, longCursor, used);
    if (!movie) return 0;
    const span = Math.min(Math.max(1, Math.ceil(movie.duration_seconds / SLOT)), slotsLeftInDay);
    entries.push({ t: dayStart + slotStart, v: movie.individual_id, d: Math.round(movie.duration_seconds), kind: 'movie', span, title: movie.collection_title });
    return span;
}

function generateWeek(weekNumber, pools, cursors, used, ads, adRng) {
    const entries = {};
    CONFIG.station.days.forEach(day => { entries[day] = []; });
    let produced = 0;

    CONFIG.station.days.forEach(day => {
        const dayEntries = entries[day];
        let hour = 0;
        while (hour < DAY_SLOTS) {
            const slotStart = hour * SLOT;
            const type = slotType(hour);
            const slotsLeft = DAY_SLOTS - hour;
            if (type === 'clip_block') {
                if (emitClipBlock(dayEntries, 0, slotStart, pools.short, cursors.short, used)) produced++;
                hour++;
            } else if (type === 'movie') {
                const span = emitMovie(dayEntries, 0, slotStart, pools.long, cursors.long, used, slotsLeft);
                if (span > 0) { produced++; hour += span; }
                else {
                    const show = takeUnused(pools.medium, cursors.medium, used);
                    if (show && emitSingleWithAds(dayEntries, 0, slotStart, show, ads, adRng, used)) produced++;
                    hour++;
                }
            } else {
                const show = takeUnused(pools.medium, cursors.medium, used);
                if (show) { emitSingleWithAds(dayEntries, 0, slotStart, show, ads, adRng, used); produced++; }
                else {
                    if (emitClipBlock(dayEntries, 0, slotStart, pools.short, cursors.short, used)) produced++;
                }
                hour++;
            }
        }
    });

    return { entries, produced };
}

function generate(categories, ads) {
    const pools = {
        short: seededOrder(categories.short, 'short'),
        medium: seededOrder(categories.medium, 'medium'),
        long: seededOrder(categories.long, 'long')
    };
    const adRng = makeRng(`${CONFIG.station.scheduleStart}:ads`);
    const adPool = ads && ads.length ? ads : [];

    const weeks = [];
    let weekNumber = 1;
    while (weekNumber <= CONFIG.station.minWeeks) {
        const cursors = {
            short: { i: rotateStart(pools.short, weekNumber, 'short') },
            medium: { i: rotateStart(pools.medium, weekNumber, 'medium') },
            long: { i: rotateStart(pools.long, weekNumber, 'long') }
        };
        const used = new Set();
        const week = generateWeek(weekNumber, pools, cursors, used, adPool, adRng);
        if (week.produced === 0) break;
        weeks.push({ week: weekNumber, entries: week.entries });
        weekNumber++;
    }

    const built = weeks.length;
    if (built < CONFIG.station.minWeeks) {
        console.warn(`SHORTFALL: produced ${built}/${CONFIG.station.minWeeks} weeks before content exhausted. Need more corpus.`);
    }
    console.log(`Generated ${built} weeks (within-week non-repeat; ads pool: ${adPool.length})`);
    return weeks;
}

module.exports = { generate, slotType, DAY_SECONDS, SLOT };
