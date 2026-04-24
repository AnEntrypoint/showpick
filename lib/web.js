const CONFIG = require('../config');

async function delay(ms = CONFIG.web.delay) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { delay };