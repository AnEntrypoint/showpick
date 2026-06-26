#!/usr/bin/env node

const CONFIG = require('./config');
const fs = require('fs');
const { load, cleanDir } = require('./lib/data');
const { categorize } = require('./lib/video');
const { generate } = require('./lib/schedule');
const { buildWeekly } = require('./lib/station');

function loadAds() {
    if (!fs.existsSync(CONFIG.input.ads)) return { videos: [] };
    return JSON.parse(fs.readFileSync(CONFIG.input.ads, 'utf8'));
}

function flattenAds(adData) {
    const ads = [];
    adData.videos.forEach(collection => {
        if (!collection.videoFiles) return;
        collection.videoFiles.forEach((f, i) => {
            const dur = f.durationMs ? parseFloat(f.durationMs) / 1000 : 0;
            if (!dur) return;
            ads.push({
                individual_id: `${collection.identifier}_file${i}`,
                collection_title: collection.title,
                duration_seconds: dur,
                direct_link: f.directLink
            });
        });
    });
    return ads;
}

function run() {
    console.log('Schedule Builder');
    console.log('================');

    cleanDir(CONFIG.output);

    const showData = load();
    const adData = loadAds();
    const categories = categorize(showData);
    const ads = flattenAds(adData);

    const weeks = generate(categories, ads);
    buildWeekly(weeks, showData, adData, 'station_1');

    console.log('\nDone!');
}

run();
