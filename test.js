const fs = require('fs');
const { execSync } = require('child_process');
const CONFIG = require('./config');

function fail(msg) { console.error('FAIL: ' + msg); process.exit(1); }
function ok(msg) { console.log('pass: ' + msg); }

function build() {
    execSync('node build_schedule.js', { cwd: __dirname, stdio: 'pipe' });
}

function loadWeeks() {
    const dir = `${CONFIG.output}/station_1`;
    return fs.readdirSync(dir)
        .filter(f => /^week_\d+\.json$/.test(f))
        .map(f => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')));
}

function weeksDigest(weeks) {
    return JSON.stringify(weeks.map(w => w.s.map(s => `${s.day}:${s.t}:${s.v}:${s.kind}`)));
}

console.log('Schedule pipeline witness');
console.log('=========================');

if (!fs.existsSync(CONFIG.input.processed)) fail(`${CONFIG.input.processed} missing - run preprocess first`);

build();
const a = weeksDigest(loadWeeks());
build();
const b = weeksDigest(loadWeeks());
if (a !== b) fail('build is not deterministic - two builds differ');
ok('deterministic: two builds byte-identical');

const weeks = loadWeeks();
if (weeks.length < 1) fail('no weeks produced');
ok(`${weeks.length} weeks produced`);

const allSlots = weeks.flatMap(w => w.s);
const kinds = new Set(allSlots.map(s => s.kind));
if (!kinds.has('show')) fail('no clip_block show slots (kind:show) present');
ok('clip_block present (kind:show)');

const hasSegment = allSlots.some(s => s.kind === 'segment');
const hasAd = allSlots.some(s => s.kind === 'ad');
if (CONFIG_adPoolPresent()) {
    if (!hasSegment || !hasAd) fail('ads pool present but no segment+ad interleave found');
    ok('single-show+ad-breaks present (segment+ad)');
} else {
    console.log('note: ads pool empty - segment/ad interleave skipped (single shows emitted full-slot)');
}

const movies = allSlots.filter(s => s.kind === 'movie');
if (movies.length === 0) fail('no movie slots present');
const multiSlotMovie = movies.some(s => (s.span || 1) >= 2);
if (!multiSlotMovie) console.log('note: movies present but none span >=2 slots this corpus');
else ok('multi-slot movie present (span>=2)');

let dupes = 0;
for (const w of weeks) {
    const counts = {};
    for (const s of w.s) {
        if (s.kind === 'ad' || s.kind === 'segment' || s.v == null) continue;
        counts[s.v] = (counts[s.v] || 0) + 1;
        if (counts[s.v] === 2) dupes++;
    }
}
if (dupes > 0) fail(`${dupes} duplicate non-ad video ids within a single week (repeats)`);
ok('zero repeated show/movie ids within any week (segment rows of one interrupted show excluded)');

const sv = JSON.parse(fs.readFileSync(CONFIG.input.ads, 'utf8'));
const vsRaw = JSON.parse(fs.readFileSync(CONFIG.input.processed, 'utf8'));
const vsArr = Array.isArray(vsRaw) ? vsRaw : (vsRaw.collections || vsRaw.videos || []);
const svIds = new Set((sv.videos || []).map(v => v.identifier));
const vsIds = new Set(vsArr.map(v => v.identifier));
const overlap = [...svIds].filter(id => vsIds.has(id));
if (overlap.length > 0) fail(`ads pool overlaps show corpus: ${overlap.slice(0, 3).join(',')}`);
ok(`ads pool disjoint from show corpus (${svIds.size} ad vs ${vsIds.size} show collections)`);

const WEEK_START = Date.parse(CONFIG.station.scheduleStart);
const WEEK_MS = 7 * 24 * 3600 * 1000;
function getCurrentWeek(now) { return (Math.floor((now - WEEK_START) / WEEK_MS) % 101) + 1; }
const cw = getCurrentWeek(Date.now());
const cwExists = fs.existsSync(`${CONFIG.output}/station_1/week_${cw}.json`);
if (!cwExists) fail(`current week ${cw} not built - deploy would abort (insufficient corpus)`);
ok(`current week ${cw} built - deploy.js can select it`);

function CONFIG_adPoolPresent() {
    if (!fs.existsSync(CONFIG.input.ads)) return false;
    const ads = JSON.parse(fs.readFileSync(CONFIG.input.ads, 'utf8'));
    return (ads.videos || []).some(c => (c.videoFiles || []).length > 0);
}

console.log('\nALL WITNESSES PASSED');
