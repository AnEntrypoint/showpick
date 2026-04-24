const CONFIG = require('../config');

function categorize(data) {
    const categories = { short: [], medium: [], long: [] };
    
    data.videos.forEach(collection => {
        if (!collection.videoFiles) return;
        collection.videoFiles.forEach((videoFile, fileIndex) => {
            const video = createVideo(collection, videoFile, fileIndex);
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
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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