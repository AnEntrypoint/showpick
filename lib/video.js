const CONFIG = require('../config');
const { makeRng, shuffleWith } = require('./rng');

function stem(name) {
    let s = name.toLowerCase().replace(/\.(mp4|avi|mov|mkv)$/i, '');
    let prev;
    do {
        prev = s;
        s = s.replace(/[._-](256k|512k|128k|64k|512kb|256kb|128kb|64kb|dvd|vcd|mpeg4|hd|sd)$/i, '');
    } while (s !== prev);
    return s.replace(/[._-]+$/, '').replace(/[^a-z0-9]+/g, '');
}

function dedupeFiles(collection) {
    const best = new Map();
    (collection.videoFiles || []).forEach((file, index) => {
        if (!file.name) return;
        const key = stem(file.name);
        const existing = best.get(key);
        if (!existing || (file.size || 0) > (existing.file.size || 0)) {
            best.set(key, { file, index });
        }
    });
    return [...best.values()];
}

function categorize(data) {
    const categories = { short: [], medium: [], long: [] };

    data.videos.forEach(collection => {
        if (!collection.videoFiles) return;
        dedupeFiles(collection).forEach(({ file, index }) => {
            const video = createVideo(collection, file, index);
            if (!video) return;

            const category = getCategory(video.duration_seconds);
            categories[category].push(video);
        });
    });

    console.log(`Categorized: ${categories.short.length} short, ${categories.medium.length} medium, ${categories.long.length} long`);
    return categories;
}

function createVideo(collection, videoFile, fileIndex) {
    if (!videoFile.name || !videoFile.name.toLowerCase().endsWith('.mp4')) return null;
    
    const duration = videoFile.durationMs ? parseFloat(videoFile.durationMs) / 1000 : 0;
    if (!duration) return null;
    
    return {
        individual_id: `${collection.identifier}_file${fileIndex}`,
        collection_id: collection.identifier,
        collection_title: collection.title,
        file_name: videoFile.name,
        duration_seconds: duration,
        direct_link: videoFile.directLink
    };
}

function getCategory(duration) {
    if (duration < CONFIG.slots.thresholds.short) return 'short';
    if (duration < CONFIG.slots.thresholds.medium) return 'medium';
    return 'long';
}

function shuffle(array) {
    const salt = `${array.length}:${array[0] ? array[0].individual_id : ''}`;
    const rng = makeRng(`${CONFIG.station.scheduleStart}:${salt}`);
    return shuffleWith(rng, array);
}

function createLookup(data) {
    const lookup = {};
    data.videos.forEach(collection => {
        if (!collection.videoFiles) return;
        collection.videoFiles.forEach((videoFile, index) => {
            const videoId = `${collection.identifier}_file${index}`;
            if (videoFile.name && videoFile.name.toLowerCase().endsWith('.mp4')) {
                lookup[videoId] = {
                    show: collection.title || 'Unknown Show',
                    episode: videoFile.name || 'Unknown Episode',
                    desc: cleanDescription(collection.description || ''),
                    u: videoFile.directLink
                };
            }
        });
    });
    return lookup;
}

function cleanDescription(description) {
    if (!description || typeof description !== 'string') return '';
    return description.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { categorize, shuffle, createLookup };