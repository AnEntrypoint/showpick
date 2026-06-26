const CONFIG = require('../config');
const { save, ensureDir } = require('./data');
const { createLookup } = require('./video');

function calculateCount() {
    return 1;
}

function splitContent(categories) {
    return [categories];
}

function buildWeekly(weeks, showData, adData, stationName) {
    const stationDir = `${CONFIG.output}/${stationName}`;
    ensureDir(stationDir);

    const showLookup = createLookup(showData);
    const adLookup = adData ? createLookup(adData) : {};
    const lookup = Object.assign({}, showLookup, adLookup);

    weeks.forEach(({ week, entries }) => {
        const slots = [];
        CONFIG.station.days.forEach((day, di) => {
            (entries[day] || []).forEach(e => {
                slots.push(Object.assign({ day, di }, e));
            });
        });
        const ids = new Set(slots.map(s => s.v));
        const weekVideos = {};
        ids.forEach(id => { if (lookup[id]) weekVideos[id] = lookup[id]; });

        const weekData = {
            v: weekVideos,
            s: slots,
            m: { start: CONFIG.station.scheduleStart, days: CONFIG.station.days, slotSeconds: CONFIG.slots.slotSeconds },
            week
        };
        save(`${stationDir}/week_${week}.json`, weekData);
    });

    console.log(`${stationName}: ${weeks.length} weeks written`);
}

module.exports = { calculateCount, splitContent, buildWeekly };
