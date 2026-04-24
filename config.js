const CONFIG = {
    input: {
        processed: 'videos_stream.json'
    },
    output: 'schedule_weeks',
    slots: {
        week: 168,
        clipBlock: { duration: 30 * 60, maxClips: 10 },
        thresholds: { short: 20 * 60, medium: 55 * 60 }
    },
    station: {
        minWeeks: 52,
        videosPerWeek: 450,
        scheduleStart: '2025-10-11T00:00:00Z',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    patterns: {
        morning: { start: 6, end: 9, type: 'clip_block' },
        primeTime: { start: 19, end: 22, type: 'long' },
        default: 'medium'
    },
    web: {
        baseUrl: 'https://archive.org',
        searchEndpoint: 'https://archive.org/advancedsearch.php',
        batchSize: 100,
        delay: 1000,
        timeout: 30000,
        retryAttempts: 3
    },
    preprocess: {
        supportedFormats: ['.mp4', '.avi', '.mov', '.mkv'],
        minDuration: 60,
        includeKeywords: [
            'cartoon', 'animation', 'animated', 'anime', 'manga',
            'tv', 'television', 'series', 'show', 'episode', 'season',
            'comedy', 'funny', 'humor', 'parody', 'satire', 'sketch',
            'cartoon network', 'adult swim', 'nickelodeon', 'disney',
            'flash animation', 'web series', 'internet series',
            'short film', 'independent', 'indie', 'underground',
            'experimental', 'surreal', 'abstract', 'avant-garde',
            'memes', 'viral', 'compilation', 'mashup', 'remix',
            'gaming', 'video game', 'machinima', 'let\'s play',
            'retro', 'vintage', 'classic', 'old', 'nostalgic',
            'weird', 'bizarre', 'unusual', 'strange', 'odd'
        ],
        excludeKeywords: [
            'porn', 'xxx', 'adult', 'explicit', 'sex', 'nude',
            'hardcore', 'softcore', 'erotic', 'sexual', 'nsfw'
        ]
    }
};

module.exports = CONFIG;