const CONFIG = require('../config');

function generatePattern() {
    const pattern = [];
    CONFIG.station.days.forEach(day => {
        for (let hour = 0; hour < 24; hour++) {
            pattern.push({ day, time: formatTime(hour), type: getSlotType(hour) });
        }
    });
    return pattern;
}

function formatTime(hour) {
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

function getSlotType(hour) {
    if (hour === 0) return 'long';
    if (hour === 12) return 'clip_block';
    if (hour >= CONFIG.patterns.morning.start && hour <= CONFIG.patterns.morning.end) return CONFIG.patterns.morning.type;
    if (hour >= CONFIG.patterns.primeTime.start && hour <= CONFIG.patterns.primeTime.end) return CONFIG.patterns.primeTime.type;
    return CONFIG.patterns.default;
}

function generateClipBlock(shortVideos, startIndex, usedVideos) {
    const clips = [];
    let totalDuration = 0;
    let currentIndex = startIndex;
    
    while (currentIndex < shortVideos.length && 
           totalDuration < CONFIG.slots.clipBlock.duration * 0.9 && 
           clips.length < CONFIG.slots.clipBlock.maxClips) {
        const video = shortVideos[currentIndex];
        if (!usedVideos.has(video.individual_id) && 
            totalDuration + video.duration_seconds <= CONFIG.slots.clipBlock.duration) {
            clips.push(video);
            totalDuration += video.duration_seconds;
            usedVideos.add(video.individual_id);
        }
        currentIndex++;
    }
    
    return clips.length > 0 ? { clips, clipsUsed: clips.length } : null;
}

function generateWeek(weekNumber, shortVideos, mediumVideos, longVideos, indices, usedVideos) {
    const weekSlots = [];
    const pattern = generatePattern();
    let { short: shortIndex, medium: mediumIndex, long: longIndex } = indices;
    
    pattern.forEach(slot => {
        if (slot.type === 'clip_block') {
            const clipBlock = generateClipBlock(shortVideos, shortIndex, usedVideos);
            if (clipBlock) {
                weekSlots.push({ week: weekNumber, day: slot.day, time: slot.time, type: 'clip_block', content: { type: 'clip_block', clips: clipBlock.clips } });
                shortIndex += clipBlock.clipsUsed;
            }
        } else if (slot.type === 'medium') {
            const video = getNextVideo(mediumVideos, mediumIndex, usedVideos);
            if (video) {
                mediumIndex = video.index + 1;
                weekSlots.push({ week: weekNumber, day: slot.day, time: slot.time, type: 'medium', content: { type: 'single_content', content: video.data } });
            }
        } else if (slot.type === 'long') {
            const video = getNextVideo(longVideos, longIndex, usedVideos);
            if (video) {
                longIndex = video.index + 1;
                weekSlots.push({ week: weekNumber, day: slot.day, time: slot.time, type: 'long', content: { type: 'single_content', content: video.data } });
            }
        }
    });
    
    return { slots: weekSlots, indices: { short: shortIndex, medium: mediumIndex, long: longIndex } };
}

function getNextVideo(videos, startIndex, usedVideos) {
    for (let i = startIndex; i < videos.length; i++) {
        if (!usedVideos.has(videos[i].individual_id)) {
            usedVideos.add(videos[i].individual_id);
            return { index: i, data: videos[i] };
        }
    }
    return null;
}

function generate(categories) {
    const schedule = [];
    let weekNumber = 1;
    const usedVideos = new Set();
    const shortVideos = require('./video').shuffle(categories.short);
    const mediumVideos = require('./video').shuffle(categories.medium);
    const longVideos = require('./video').shuffle(categories.long);
    let indices = { short: 0, medium: 0, long: 0 };
    
    while (weekNumber <= 1000) {
        const weekSchedule = generateWeek(weekNumber, shortVideos, mediumVideos, longVideos, indices, usedVideos);
        if (weekSchedule.slots.length < CONFIG.slots.week) break;
        schedule.push(...weekSchedule.slots);
        indices = weekSchedule.indices;
        weekNumber++;
    }
    
    console.log(`Generated ${schedule.length} slots across ${weekNumber - 1} weeks`);
    return schedule;
}

function addClipToTime(timeString, secondsToAdd) {
    const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return timeString;
    let [, hours, minutes, period] = match;
    hours = parseInt(hours); minutes = parseInt(minutes); period = period.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    const totalMinutes = hours * 60 + minutes + Math.floor(secondsToAdd / 60);
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = totalMinutes % 60;
    let displayHours = newHours, displayPeriod = 'AM';
    if (newHours === 0) { displayHours = 12; displayPeriod = 'AM'; }
    else if (newHours < 12) { displayHours = newHours; displayPeriod = 'AM'; }
    else if (newHours === 12) { displayHours = 12; displayPeriod = 'PM'; }
    else { displayHours = newHours - 12; displayPeriod = 'PM'; }
    return `${displayHours}:${newMinutes.toString().padStart(2, '0')} ${displayPeriod}`;
}

module.exports = { generate, addClipToTime };