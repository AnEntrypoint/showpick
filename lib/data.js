const fs = require('fs');
const CONFIG = require('../config');

function load(path = CONFIG.input.processed) {
    const data = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log(`Loaded ${data.videos.length} collections`);
    return data;
}

function save(path, content) {
    fs.writeFileSync(path, JSON.stringify(content, null, 2));
}

function ensureDir(path) {
    if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
}

function cleanDir(path) {
    if (fs.existsSync(path)) fs.rmSync(path, { recursive: true });
    ensureDir(path);
}

module.exports = { load, save, ensureDir, cleanDir };