const https = require('https');
const CONFIG = require('../config');
const { save } = require('./data');

class ArchiveVideoFinder {
    constructor() {
        this.baseURL = 'https://archive.org/advancedsearch.php';
        this.metadataURL = 'https://archive.org/metadata/';
        this.seen = new Set();
    }

    getSearchQueries() {
        return CONFIG.preprocess.queries;
    }

    async searchArchive(query, page) {
        const params = new URLSearchParams({
            q: query,
            output: 'json',
            rows: CONFIG.web.batchSize,
            page: page
        });
        params.append('fl[]', 'identifier');
        const url = `${this.baseURL}?${params}`;
        const raw = await this.get(url);
        try {
            return JSON.parse(raw);
        } catch (e) {
            return { response: { docs: [] } };
        }
    }

    getOnce(url, timeout = CONFIG.web.timeout) {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
        });
    }

    async get(url, timeout = CONFIG.web.timeout) {
        const retries = CONFIG.preprocess.searchRetries || 1;
        let lastErr;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await this.getOnce(url, timeout);
            } catch (e) {
                lastErr = e;
                const transient = e.message === 'timeout' || e.code === 'ENOTFOUND' || e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'EAI_AGAIN';
                if (!transient || attempt === retries) throw e;
                console.warn(`Retry ${attempt}/${retries - 1} after ${e.code || e.message}`);
                await new Promise(r => setTimeout(r, attempt * 2000));
            }
        }
        throw lastErr;
    }

    async getMetadata(identifier) {
        try {
            return JSON.parse(await this.get(`${this.metadataURL}${identifier}`));
        } catch (e) {
            return {};
        }
    }

    extractDuration(file) {
        if (file.length) return parseFloat(file.length);
        if (file.duration) return parseFloat(file.duration);
        if (file.durationMs) return parseFloat(file.durationMs) / 1000;
        return null;
    }

    processVideoFiles(files, identifier) {
        const videoFiles = [];
        Object.values(files).forEach(file => {
            if (!file.name) return;
            const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            if (!CONFIG.preprocess.supportedFormats.includes(ext)) return;
            if (file.name.toLowerCase().includes('.ia.mp4')) return;
            const duration = this.extractDuration(file);
            if (!duration || duration < CONFIG.preprocess.minDuration) return;
            videoFiles.push({
                name: file.name,
                durationMs: duration * 1000,
                size: file.size || 0,
                directLink: `https://archive.org/download/${identifier}/${encodeURIComponent(file.name)}`,
                streamingLink: ''
            });
        });
        return videoFiles;
    }

    wordMatch(text, keyword) {
        const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(text);
    }

    passesRelevance(text) {
        const t = (text || '').toLowerCase();
        for (const bad of CONFIG.preprocess.excludeKeywords) {
            if (this.wordMatch(t, bad)) return false;
        }
        if (!CONFIG.preprocess.requireThemeMatch) return true;
        for (const good of CONFIG.preprocess.includeKeywords) {
            if (this.wordMatch(t, good)) return true;
        }
        return false;
    }

    async processCollection(identifier) {
        const response = await this.getMetadata(identifier);
        const meta = response.metadata || {};
        const files = response.files || [];
        if (!files.length) return null;
        const videoFiles = this.processVideoFiles(files, identifier);
        if (videoFiles.length === 0) return null;
        const getFirst = v => Array.isArray(v) ? v[0] : v;
        const collections = Array.isArray(meta.collection) ? meta.collection : (meta.collection ? [meta.collection] : []);
        const blocked = CONFIG.preprocess.blockedCollections || [];
        if (collections.some(c => blocked.includes(c))) return null;
        const haystack = [getFirst(meta.title), getFirst(meta.description), getFirst(meta.subject), identifier].join(' ');
        if (!this.passesRelevance(haystack)) return null;
        return {
            identifier,
            title: getFirst(meta.title) || identifier,
            description: getFirst(meta.description) || '',
            creator: getFirst(meta.creator) || '',
            year: getFirst(meta.year) || '',
            category: getFirst(meta.collection) || '',
            downloads: getFirst(meta.downloads) || 0,
            videoFiles
        };
    }

    async fetchFromQueries(queries, onCollection, maxPages) {
        for (const queryConfig of queries) {
            console.log(`Searching: ${queryConfig.category}`);
            for (let page = 1; page <= maxPages; page++) {
                let results;
                try {
                    results = await this.searchArchive(queryConfig.query, page);
                } catch (e) {
                    console.warn(`Search error ${queryConfig.category} page ${page}: ${e.message}`);
                    break;
                }
                const docs = (results.response && results.response.docs) || [];
                if (docs.length === 0) break;
                for (const doc of docs) {
                    if (!doc.identifier || this.seen.has(doc.identifier)) continue;
                    this.seen.add(doc.identifier);
                    try {
                        const collection = await this.processCollection(doc.identifier);
                        if (collection) onCollection(collection, queryConfig);
                    } catch (e) {
                        // skip unreadable collection, keep going
                    }
                    await new Promise(r => setTimeout(r, CONFIG.web.delay));
                }
                if (docs.length < CONFIG.web.batchSize) break;
            }
        }
    }
}

async function process() {
    console.log('Web Video Stream Preprocessor');
    console.log('==============================');

    const finder = new ArchiveVideoFinder();

    const shows = {
        generated: new Date().toISOString(),
        total_collections: 0,
        unique_collections: 0,
        videos: []
    };
    const ads = {
        generated: new Date().toISOString(),
        total_collections: 0,
        videos: []
    };

    await finder.fetchFromQueries(CONFIG.preprocess.queries, (collection) => {
        shows.videos.push(collection);
        console.log(`show collection ${shows.videos.length}: ${collection.title} (${collection.videoFiles.length} files)`);
    }, CONFIG.preprocess.showPages);

    await finder.fetchFromQueries(CONFIG.preprocess.adQueries, (collection) => {
        ads.videos.push(collection);
        console.log(`ad collection ${ads.videos.length}: ${collection.title} (${collection.videoFiles.length} files)`);
    }, CONFIG.preprocess.adPages);

    shows.total_collections = shows.videos.length;
    shows.unique_collections = shows.videos.length;
    ads.total_collections = ads.videos.length;

    let files = 0, sh = 0, me = 0, lo = 0;
    shows.videos.forEach(c => c.videoFiles.forEach(f => {
        files++;
        const d = f.durationMs / 1000;
        if (d < CONFIG.slots.thresholds.short) sh++;
        else if (d < CONFIG.slots.thresholds.medium) me++;
        else lo++;
    }));
    let adFiles = 0;
    ads.videos.forEach(c => c.videoFiles.forEach(() => adFiles++));

    console.log(`\nShows: ${shows.videos.length} collections, ${files} files (${sh} short, ${me} medium, ${lo} long/movie)`);
    console.log(`Ads: ${ads.videos.length} collections, ${adFiles} clips`);

    return { shows, ads };
}

async function run() {
    try {
        const { shows, ads } = await process();
        save(CONFIG.input.processed, shows);
        save(CONFIG.input.ads, ads);
        console.log(`Created ${CONFIG.input.processed} (${shows.videos.length} show collections)`);
        console.log(`Created ${CONFIG.input.ads} (${ads.videos.length} ad collections)`);
    } catch (error) {
        console.error('Preprocessing failed:', error.message);
        process.exit(1);
    }
}

module.exports = { process, run, ArchiveVideoFinder };