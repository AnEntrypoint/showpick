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
                category: 'adult_swim',
                query: '("adult swim" OR "robot chicken" OR "moral orel" OR "superjail" OR "sealab 2021" OR "aqua teen hunger force" OR "metalocalypse" OR "squidbillies" OR "12 oz mouse" OR "tim and eric" OR "xavier renegade angel") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'edgy_animation',
                query: '("south park" OR "family guy" OR "american dad" OR "rick and morty" OR "beavis and butthead" OR "ren and stimpy" OR "boondocks" OR "king of the hill") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'sketch_comedy',
                query: '(("key and peele" OR "chappelle show" OR "mad tv" OR "in living color" OR "the state" OR "mr show" OR "kith") AND (comedy OR sketch OR special)) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'standup_comedy',
                query: '(standup OR "stand up" OR comedian OR special) AND (edgy OR dark OR comedy) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'internet_memes',
                query: '(meme OR "meme culture" OR "internet culture" OR viral OR compilation) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'comedy_compilations',
                query: '(funny OR comedy OR hilarious) AND (compilation OR montage OR "best of") AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'animation_weird',
                query: '(animation OR animated OR cartoon) AND (surreal OR weird OR bizarre OR experimental OR abstract) AND mediatype:(movies OR opensource_movies)',
                filters: [],
                sort: 'downloads desc'
            },
            {
                category: 'internet_content',
                query: '("flash animation" OR newgrounds OR "internet series" OR "web series" OR "youtube" OR "web video") AND mediatype:(movies OR opensource_movies)',
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
            const url = `https://archive.org/metadata/${identifier}`;
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const meta = JSON.parse(data);
                        resolve(meta.files || []);
                    } catch (e) {
                        resolve([]);
                    }
                });
            }).on('error', reject);
        });
    }

    hasEnglishContent(metadata, files) {
        const getStr = (val) => Array.isArray(val) ? val.join(' ') : (val || '');
        const text = `${getStr(metadata.title)} ${getStr(metadata.description)} ${getStr(metadata.creator)}`.toLowerCase();

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

        const hasEnglishFiles = (Array.isArray(files) ? files : Object.values(files)).some(file =>
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
        const getStr = (val) => Array.isArray(val) ? val.join(' ') : (val || '');
        const text = `${getStr(metadata.title)} ${getStr(metadata.description)} ${getStr(metadata.creator)} ${getStr(metadata.collection)}`.toLowerCase();
        const keywords = CONFIG.preprocess.includeKeywords;

        return keywords.some(keyword => text.includes(keyword.toLowerCase()));
    }

    hasExcludedContent(metadata) {
        const getStr = (val) => Array.isArray(val) ? val.join(' ') : (val || '');
        const text = `${getStr(metadata.title)} ${getStr(metadata.description)} ${getStr(metadata.creator)} ${getStr(metadata.collection)}`.toLowerCase();
        const excludeKeywords = CONFIG.preprocess.excludeKeywords;

        return excludeKeywords.some(keyword => text.includes(keyword.toLowerCase()));
    }

    async processCollection(identifier) {
        try {
            const response = await this.getMetadata(identifier);
            const meta = response.metadata || {};
            const files = response.files || [];

            if (!meta || !files.length) return null;

            if (this.hasExcludedContent(meta)) {
                console.warn(`Skipping ${identifier}: excluded content detected`);
                return null;
            }

            if (!this.hasEnglishContent(meta, files)) {
                console.warn(`Skipping ${identifier}: no English content detected`);
                return null;
            }

            const videoFiles = this.processVideoFiles(files, identifier);
            if (videoFiles.length === 0) return null;

            const getFirst = (val) => Array.isArray(val) ? val[0] : val;
            return {
                identifier: identifier,
                title: getFirst(meta.title) || identifier,
                description: getFirst(meta.description) || '',
                creator: getFirst(meta.creator) || '',
                year: getFirst(meta.year) || '',
                category: getFirst(meta.collection) || '',
                downloads: getFirst(meta.downloads) || 0,
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