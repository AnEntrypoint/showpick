const CONFIG = require('../config');
const { save, ensureDir } = require('./data');
const { createLookup } = require('./video');
const { addClipToTime } = require('./schedule');

function calculateCount(categories) {
    const totalVideos = categories.short.length + categories.medium.length + categories.long.length;
    const videosPerStation = CONFIG.station.videosPerWeek * CONFIG.station.minWeeks;
    return Math.max(1, Math.floor(totalVideos / videosPerStation));
}

function splitContent(categories, numStations) {
    const split = (arr, n) => {
        const size = Math.ceil(arr.length / n);
        return Array.from({ length: n }, (_, i) => arr.slice(i * size, (i + 1) * size));
    };
    
    return Array.from({ length: numStations }, (_, i) => ({
        short: split(categories.short, numStations)[i] || [],
        medium: split(categories.medium, numStations)[i] || [],
        long: split(categories.long, numStations)[i] || []
    }));
}

function buildWeekly(schedule, videoData, stationName) {
    const stationDir = `${CONFIG.output}/${stationName}`;
    ensureDir(stationDir);
    
    const videoLookup = createLookup(videoData);
    const scheduleSlots = transformSlots(schedule);
    const weeklySlots = groupByWeek(scheduleSlots);
    
    Object.keys(weeklySlots).sort((a, b) => parseInt(a) - parseInt(b)).forEach(week => {
        const weekSlots = weeklySlots[week];
        const weekData = createWeekData(week, weekSlots, videoLookup);
        save(`${stationDir}/week_${week}.json`, weekData);
    });
    
    console.log(`${stationName}: ${Object.keys(weeklySlots).length} weeks, ${scheduleSlots.length} slots`);
}

function transformSlots(schedule) {
    const slots = [];
    schedule.forEach(slot => {
        if (slot.content.type === 'single_content') {
            const video = slot.content.content;
            if (video.file_name && video.file_name.toLowerCase().endsWith('.mp4')) {
                slots.push({ w: slot.week, d: slot.day, t: slot.time, v: video.individual_id, du: video.duration_seconds || 0 });
            }
        } else if (slot.content.type === 'clip_block') {
            let clipStartTime = 0;
            slot.content.clips.forEach(clip => {
                if (clip.file_name && clip.file_name.toLowerCase().endsWith('.mp4')) {
                    slots.push({ w: slot.week, d: slot.day, t: addClipToTime(slot.time, clipStartTime), v: clip.individual_id, du: clip.duration_seconds || 60 });
                    clipStartTime += clip.duration_seconds || 60;
                }
            });
        }
    });
    return slots;
}

function groupByWeek(slots) {
    const weekly = {};
    slots.forEach(slot => {
        if (!weekly[slot.w]) weekly[slot.w] = [];
        weekly[slot.w].push(slot);
    });
    return weekly;
}

function createWeekData(week, weekSlots, videoLookup) {
    const weekVideoIds = new Set();
    weekSlots.forEach(slot => weekVideoIds.add(slot.v));
    
    const weekVideos = {};
    weekVideoIds.forEach(videoId => {
        if (videoLookup[videoId]) weekVideos[videoId] = videoLookup[videoId];
    });
    
    return {
        v: weekVideos,
        s: weekSlots,
        m: { start: CONFIG.station.scheduleStart, days: CONFIG.station.days },
        week: parseInt(week)
    };
}

module.exports = { calculateCount, splitContent, buildWeekly };