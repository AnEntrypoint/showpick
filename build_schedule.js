#!/usr/bin/env node

const CONFIG = require('./config');
const { load, cleanDir } = require('./lib/data');
const { categorize } = require('./lib/video');
const { generate } = require('./lib/schedule');
const { calculateCount, splitContent, buildWeekly } = require('./lib/station');

function run() {
    console.log('Schedule Builder');
    console.log('================');
    
    cleanDir(CONFIG.output);
    
    const data = load();
    const categories = categorize(data);
    const numStations = calculateCount(categories);
    console.log(`Creating ${numStations} station(s) based on content volume`);
    
    const stationCategories = splitContent(categories, numStations);
    
    stationCategories.forEach((cats, i) => {
        const stationName = `station_${i + 1}`;
        console.log(`\nBuilding ${stationName}...`);
        const schedule = generate(cats);
        buildWeekly(schedule, data, stationName);
    });
    
    console.log('\nDone!');
}

run();