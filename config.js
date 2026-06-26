const CONFIG = {
    input: {
        processed: 'videos_stream.json',
        ads: 'saved_videos.json'
    },
    output: 'schedule_weeks',
    slots: {
        week: 168,
        slotSeconds: 3600,
        clipBlock: { duration: 60 * 60, maxClips: 20 },
        thresholds: { short: 20 * 60, medium: 55 * 60, movie: 55 * 60 },
        adBreaks: { min: 2, max: 6 }
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
        delay: 300,
        timeout: 12000,
        retryAttempts: 3
    },
    preprocess: {
        supportedFormats: ['.mp4'],
        minDuration: 60,
        showPages: 12,
        adPages: 6,
        requireThemeMatch: true,
        searchRetries: 2,
        blockedCollections: [
            'speed_runs', 'gamevideos', 'cdbbsia', 'gamecip',
            'sports', 'newsandpublicaffairs', 'opensource_audio',
            'librivoxaudio', 'gratefuldead', 'etree',
            'mirrortube', 'social-media-video'
        ],
        queries: [
            { category: 'glitch_art', query: 'glitch mediatype:(movies)' },
            { category: 'datamosh', query: 'datamosh mediatype:(movies)' },
            { category: 'vj_loops', query: 'VJ loop mediatype:(movies)' },
            { category: 'abstract_film', query: 'abstract film mediatype:(movies)' },
            { category: 'experimental', query: 'experimental animation mediatype:(movies)' },
            { category: 'video_art', query: 'video art mediatype:(movies)' },
            { category: 'analog_horror', query: 'analog horror mediatype:(movies)' },
            { category: 'demoscene', query: 'demoscene mediatype:(movies)' },
            { category: 'psychedelic', query: 'psychedelic visuals mediatype:(movies)' },
            { category: 'cult_film', query: 'cult film mediatype:(movies)' },
            { category: 'experimental_feature', query: 'experimental feature film mediatype:(movies)' },
            { category: 'avant_garde', query: 'avant-garde cinema mediatype:(movies)' },
            { category: 'surreal_short', query: 'surreal short film mediatype:(movies)' },
            { category: 'animation_short', query: 'animation short film mediatype:(movies)' },
            { category: 'flash_animation', query: 'flash animation mediatype:(movies)' },
            { category: 'newgrounds', query: 'newgrounds animation mediatype:(movies)' },
            { category: 'machinima', query: 'machinima mediatype:(movies)' },
            { category: 'video_collage', query: 'video collage experimental mediatype:(movies)' },
            { category: 'found_footage', query: 'found footage experimental mediatype:(movies)' },
            { category: 'noise_video', query: 'noise video art mediatype:(movies)' },
            { category: 'cyberpunk_short', query: 'cyberpunk short film mediatype:(movies)' },
            { category: 'pixel_art', query: 'pixel art animation mediatype:(movies)' },
            { category: 'motion_graphics', query: 'motion graphics experimental mediatype:(movies)' },
            { category: 'visual_music', query: 'visual music abstract mediatype:(movies)' },
            { category: 'stop_motion', query: 'stop motion experimental mediatype:(movies)' },
            { category: 'underground_film', query: 'underground film mediatype:(movies)' },
            { category: 'b_movie', query: 'b-movie cult mediatype:(movies)' },
            { category: 'public_domain_cartoon', query: 'public domain cartoon mediatype:(movies)' },
            { category: 'vintage_animation', query: 'vintage animation surreal mediatype:(movies)' }
        ],
        adQueries: [
            { category: 'tv_commercials', query: 'vintage television commercials mediatype:(movies)' },
            { category: 'station_idents', query: 'station ident bumper mediatype:(movies)' },
            { category: 'retro_ads', query: 'retro advertisement mediatype:(movies)' },
            { category: 'psa', query: 'public service announcement mediatype:(movies)' }
        ],
        includeKeywords: [
            'glitch', 'datamosh', 'datamoshing', 'databending',
            'cartoon', 'animation', 'animated', 'anime', 'cel animation',
            'experimental', 'surreal', 'abstract', 'avant-garde', 'avantgarde',
            'short film', 'shorts', 'animated short', 'indie', 'independent',
            'underground', 'cult', 'b-movie', 'b movie', 'exploitation',
            'video art', 'visual music', 'motion graphics', 'noise',
            'vj', 'vj loop', 'psychedelic', 'trippy', 'kaleidoscope',
            'demoscene', 'demo scene', 'machinima', 'flash animation',
            'newgrounds', 'stop motion', 'claymation', 'pixel art',
            'analog horror', 'found footage', 'cyberpunk', 'vaporwave',
            'collage', 'mashup', 'remix', 'montage', 'psychotronic',
            'weird', 'bizarre', 'strange', 'surrealism', 'dada', 'dreamlike'
        ],
        excludeKeywords: [
            'porn', 'xxx', 'explicit', 'sex', 'nude',
            'hardcore', 'softcore', 'erotic', 'sexual',
            'kids', 'children', 'educational', 'preschool', 'toddler',
            'pokemon', 'spongebob', 'looney tunes', 'tom and jerry',
            'winnie pooh', 'sesame street', 'caillou', 'dora',
            'bluey', 'paw patrol', 'peppa pig', 'baby shark',
            'pg-13', 'g rated', 'rated g', 'all ages', 'family friendly',
            'hitler', 'nazi', 'antisemitic', 'racist', 'hate speech',
            'holocaust denial', 'white supremacy', 'kkk', 'neo-nazi',
            'fascist', 'communism', 'extremist', 'terrorism',
            'course', 'lecture', 'tutorial', 'lesson', 'quran', 'bible',
            'sermon', 'training', 'webinar', 'how to', 'walkthrough',
            'longplay', 'long play', 'full playthrough', 'speedrun',
            'gameplay', 'unboxing', 'review', 'podcast', 'interview',
            'sports', 'football', 'basketball', 'news broadcast',
            'speedrun', 'any%', 'new game+', 'glitchless', 'tas run',
            'lets play', "let's play", 'playthrough', 'no commentary',
            'full game', 'boss fight', 'all bosses', 'all cutscenes',
            'world record', 'wr run', 'pb run', 'ranked match', 'fancam'
        ]
    }
};

module.exports = CONFIG;