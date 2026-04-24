const fs = require('fs');
const https = require('https');
const CONFIG = require('../config');
const { save } = require('./data');

class ArchiveVideoFinder {
    constructor() {
        this.baseURL = 'https://archive.org/advancedsearch.php';
        this.metadataURL = 'https://archive.org/metadata/';
        this.videoList = [];
    }

    getSearchQueries() {
        return [
            {
                category: 'high_energy_memes',
                query: '("dank memes" OR "vine compilation" OR "tiktok funny" OR "youtube poop" OR ytp OR "meme compilation" OR "funny compilation" OR "viral videos" OR "montage parody" OR "mlg montage" OR "shitposting" OR "ironic memes" OR "cringe comedy" OR "fail compilation" OR "funny moments" OR "best of" OR compilation OR "viral compilation" OR "meme mashup" OR "epic compilation" OR "intense memes" OR "high energy" OR "chaotic" OR "fast paced" OR "rapid fire") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'datamosh_glitch',
                query: '(datamosh OR "data mosh" OR glitch OR "glitch art" OR "digital corruption" OR "pixel sorting" OR "bytebeat" OR "chiptune" OR "circuit bending" OR "error aesthetic" OR "compression artifacts" OR "mpeg artifacts" OR "digital decay" OR "corrupted video" OR "glitchy" OR "pixelated" OR "distorted" OR "digital noise" OR artifact OR "compression glitch" OR "VJ loops" OR VJ OR "video loops" OR "live visuals" OR visuals OR "video art" OR "digital art" OR experimental OR abstract OR surreal OR "motion graphics" OR "visual effects") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'tech_gaming_comedy',
                query: '(machinima OR "red vs blue" OR "rooster teeth" OR "achievement hunter" OR "tech support" OR "it crowd" OR programming OR hacking OR coding) AND (funny OR comedy OR parody OR satire OR hilarious OR "tech humor") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'dark_edgy_comedy',
                query: '(("dark humor" OR "black comedy" OR "offensive humor" OR shock OR controversial OR "4chan" OR reddit OR liveleak) AND (funny OR comedy OR compilation OR parody OR satire)) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'adult_animation',
                query: '("ren and stimpy" OR "beavis and butthead" OR "south park" OR "family guy" OR "american dad" OR "the simpsons" OR "boondocks" OR "hazbin hotel" OR "king of the hill" OR "adult swim" OR "robot chicken" OR "moral orel" OR "superjail") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'modern_sitcoms',
                query: '("the office" OR "parks and recreation" OR community OR "arrested development" OR "it\'s always sunny" OR "brooklyn nine nine" OR "rick and morty" OR "the good place") AND (complete OR series OR episodes OR compilation) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'lost_internet_content',
                query: '("lost youtube" OR "deleted youtube" OR "archived youtube" OR "lost media" OR "deleted scenes" OR "internet archive" OR "viral deleted" OR "removed content") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'anime_english',
                query: '(anime OR "dragon ball" OR dragonball OR digimon OR "x-men" OR xmen OR spiderman OR "spider-man" OR "final space" OR spongebob OR "one piece" OR naruto OR "death note" OR "attack on titan") AND (english OR dub OR sub OR "english dub" OR "english sub") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'vintage_cartoons',
                query: '(cartoon OR animation OR animated OR "classic cartoon" OR "vintage cartoon" OR "golden age" OR "merrie melodies" OR "looney tunes" OR "tom and jerry" OR "mickey mouse" OR "betty boop" OR "popeye" OR "felix the cat" OR "woody woodpecker" OR "superman" OR "fleischer" OR "warner bros" OR "mgm" OR "walt disney" OR "technicolor" OR datamosh OR "data mosh" OR glitch OR "glitch art" OR "digital corruption" OR "pixel sorting" OR "bytebeat" OR "chiptune" OR "circuit bending" OR "error aesthetic" OR "compression artifacts" OR "mpeg artifacts" OR "digital decay" OR "corrupted video" OR "glitchy" OR "pixelated" OR "distorted" OR "digital noise" OR artifact OR "compression glitch") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'weird_internet',
                query: '("wonder showzen" OR "xavier renegade angel" OR "millennium" OR "tim and eric" OR "eric andre" OR "adult swim" OR "experimental film" OR "surreal comedy" OR "weird cartoons" OR "bizarre animation" OR "psychedelic" OR "trippy" OR "visual art" OR "motion graphics" OR "video art" OR "absurdist" OR "dada" OR "surrealism") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'lost_nostalgia',
                query: '("lost media" OR "deleted scenes" OR "rare footage" OR "vintage commercials" OR "retro cartoons" OR "old animation" OR "forgotten films" OR "obscure cartoons" OR "banned cartoons" OR "unaired episodes") AND (cool, weird, funny, bizarre, interesting) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'retro_animation',
                query: '("flash animation" OR "newgrounds" OR "albino blacksheep" OR "homestar runner" OR "weebl" OR "jibjab" OR "animutation" OR "salad fingers" OR "burnt face man" OR "stick death" OR "zone archive" OR "speedosausage" OR "flash cartoons" OR "internet animation") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'cartoon_network_weird',
                query: '("cartoon network" OR "cartoon cartoon" OR "adult swim" OR "liquid television" OR "aeon flux" OR "space ghost" OR "harvey birdman" OR "sealab 2021" OR "aqua teen hunger force" OR "perfect hair forever" OR "tom goes to the mayor" OR "wonder showzen" OR "brak show") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'adult_swim_extended',
                query: '("robot chicken" OR "moral orel" OR "superjail" OR "metalocalypse" OR "squidbillies" OR "12 oz mouse" OR "smiling friends" OR "off the air" OR "infomercials" OR "too many cooks" OR "tim and eric" OR "xavier renegade angel") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'sketch_comedy',
                query: '("key and peele" OR "key & peele" OR "whitest kids u know" OR "wkuk" OR "mr show" OR "chappelle show" OR "mad tv" OR "in living color" OR "the state" OR "human giant" OR "upright citizens brigade" OR "kids in the hall") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'modern_comedy_films',
                query: '(("comedy film" OR "comedy movie" OR "dark comedy" OR "black comedy" OR "satire film" OR "parody movie") AND (2000..2025 OR modern OR contemporary OR indie OR "independent film" OR "cult classic")) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'mlg_gaming_memes',
                query: '("mlg compilation" OR "best mlg" OR "gaming memes" OR "funny gaming" OR "pro compilation" OR "gaming montage" OR "epic gaming" OR "360 noscope" OR "quickscope" OR "gaming fails") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'funny_compilations',
                query: '("funny compilation" OR "funny moments" OR "funny videos" OR "comedy compilation" OR "hilarious compilation" OR "laugh compilation" OR "comedy gold" OR "funny gold") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            }
        ];
    }

    async searchArchive(query, page = 1) {
        const params = new URLSearchParams({
            q: query,
            fl: 'identifier,title,description,creator,year,category,downloads',
            output: 'json',
            rows: CONFIG.web.batchSize,
            page: page
        });

        return new Promise((resolve, reject) => {
            const url = `${this.baseURL}?${params}`;
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    async getMetadata(identifier) {
        return new Promise((resolve, reject) => {
            const url = `${this.metadataURL}${identifier}`;
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({});
                    }
                });
            }).on('error', reject);
        });
    }

    async getFiles(identifier) {
        return new Promise((resolve, reject) => {
            const url = `https://archive.org/download/${identifier}`;
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const files = JSON.parse(data);
                        resolve(files);
                    } catch (e) {
                        resolve({});
                    }
                });
            }).on('error', reject);
        });
    }

    hasEnglishContent(metadata, files) {
        const text = `${metadata.title || ''} ${metadata.description || ''} ${metadata.creator || ''}`.toLowerCase();
        
        const englishIndicators = [
            'english dub', 'english dubbed', 'english sub', 'english subtitle',
            'dubbed in english', 'subtitled in english', 'english audio',
            'eng dub', 'eng sub', 'eng audio', 'english version',
            'animax dub', 'funimation dub', 'viz media dub',
            'dual audio', 'multi audio', 'bilingual', 'multilanguage'
        ];
        
        const hasEnglishIndicator = englishIndicators.some(indicator => 
            text.includes(indicator)
        );
        
        const hasEnglishFiles = Object.values(files).some(file => 
            file.name && (
                file.name.toLowerCase().includes('english') ||
                file.name.toLowerCase().includes('eng') ||
                file.name.toLowerCase().includes('dub') ||
                file.name.toLowerCase().includes('sub')
            )
        );
        
        const isPrimarilyEnglish = this.isEnglishText(text);
        
        return hasEnglishIndicator || hasEnglishFiles || isPrimarilyEnglish;
    }

    isEnglishText(text) {
        if (!text || text.length < 10) return false;
        
        const englishWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by|from|up|about|into|through|during|before|after|above|below|between|among|under|over|above|below|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|can|this|that|these|those|a|an|i|you|he|she|it|we|they|me|him|her|us|them|my|your|his|her|its|our|their)\b/gi;
        
        const englishMatches = text.match(englishWords) || [];
        const englishScore = englishMatches.length;
        
        return englishScore >= 1;
    }

    hasRelevantContent(metadata) {
        const text = `${metadata.title || ''} ${metadata.description || ''} ${metadata.creator || ''} ${(metadata.collection || []).join(' ')}`.toLowerCase();
        const keywords = CONFIG.preprocess.includeKeywords;
        
        return keywords.some(keyword => text.includes(keyword.toLowerCase()));
    }

    hasExcludedContent(metadata) {
        const text = `${metadata.title || ''} ${metadata.description || ''} ${metadata.creator || ''} ${(metadata.collection || []).join(' ')}`.toLowerCase();
        const excludeKeywords = CONFIG.preprocess.excludeKeywords;
        
        return excludeKeywords.some(keyword => text.includes(keyword.toLowerCase()));
    }

    async processCollection(identifier) {
        try {
            const metadata = await this.getMetadata(identifier);
            const files = await this.getFiles(identifier);
            
            if (!metadata || !files) return null;

            if (!this.hasEnglishContent(metadata, files)) {
                console.warn(`Skipping ${identifier}: no English content detected`);
                return null;
            }

            if (!this.hasRelevantContent(metadata)) {
                console.warn(`Skipping ${identifier}: no relevant content detected`);
                return null;
            }

            if (this.hasExcludedContent(metadata)) {
                console.warn(`Skipping ${identifier}: excluded content detected`);
                return null;
            }

            const videoFiles = this.processVideoFiles(files, identifier);
            if (videoFiles.length === 0) return null;

            return {
                identifier: identifier,
                title: metadata.title || metadata.metadata?.title?.[0] || identifier,
                description: metadata.description || metadata.metadata?.description?.[0] || '',
                creator: metadata.creator || metadata.metadata?.creator?.[0] || '',
                year: metadata.year || metadata.metadata?.year?.[0] || '',
                category: metadata.collection || metadata.metadata?.collection?.[0] || '',
                downloads: metadata.downloads || 0,
                videoFiles: videoFiles
            };
        } catch (error) {
            console.warn(`Failed to process ${identifier}: ${error.message}`);
            return null;
        }
    }

    processVideoFiles(files, identifier) {
        const videoFiles = [];
        const supportedFormats = CONFIG.preprocess.supportedFormats;

        Object.values(files).forEach(file => {
            if (!file.name) return;

            const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            if (!supportedFormats.includes(extension)) return;

            const duration = this.extractDuration(file);
            if (!duration || duration < CONFIG.preprocess.minDuration) return;

            videoFiles.push({
                name: file.name,
                durationMs: duration * 1000,
                size: file.size || 0,
                directLink: `https://archive.org/download/${identifier}/${file.name}`,
                streamingLink: ''
            });
        });

        return videoFiles;
    }

    extractDuration(file) {
        if (file.duration) return parseFloat(file.duration);
        if (file.durationMs) return parseFloat(file.durationMs) / 1000;
        if (file.length) return parseFloat(file.length);
        return null;
    }

    async findAllVideos(callback) {
        const queries = this.getSearchQueries();
        
        for (const queryConfig of queries) {
            console.log(`\n🔍 Searching: ${queryConfig.category}`);
            
            for (let page = 1; ; page++) {
                try {
                    const results = await this.searchArchive(queryConfig.query, page);
                    
                    if (!results || !results.docs || results.docs.length === 0) break;

                    for (const doc of results.docs) {
                        if (!doc.identifier) continue;
                        
                        const collection = await this.processCollection(doc.identifier);
                        if (collection) {
                            callback(collection);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, CONFIG.web.delay));
                    }

                    if (results.docs.length < CONFIG.web.batchSize) break;
                    
                    console.log(`   Page ${page}: ${results.docs.length} collections found`);
                    
                } catch (error) {
                    console.warn(`Search error on page ${page}: ${error.message}`);
                    break;
                }
            }
        }
    }
}

async function process() {
    console.log('Web Video Stream Preprocessor');
    console.log('==============================');
    
    const processed = {
        generated: new Date().toISOString(),
        total_collections: 0,
        videos: []
    };
    
    const finder = new ArchiveVideoFinder();
    
    await new Promise((resolve, reject) => {
        finder.findAllVideos((collection) => {
            processed.videos.push(collection);
            processed.total_collections = processed.videos.length;
            
            console.log(`📦 Processed ${processed.total_collections}: ${collection.title}`);
        }).then(resolve).catch(reject);
    });
    
    console.log(`\n📊 Total collections processed: ${processed.videos.length}`);
    return processed;
}

async function run() {
    try {
        const processedData = await process();
        save(CONFIG.input.processed, processedData);
        console.log(`✅ Created ${CONFIG.input.processed}`);
        console.log(`📊 ${processedData.videos.length} collections with video files`);
    } catch (error) {
        console.error('❌ Preprocessing failed:', error.message);
        process.exit(1);
    }
}

module.exports = { process, run };