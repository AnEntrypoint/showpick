#!/usr/bin/env node

/**
 * Quick test without AI to verify WFGY processor functionality
 */

const fs = require('fs');
const WFGYVideoProcessor = require('./wfgy_video_processor');

async function quickTest() {
    console.log('⚡ Quick WFGY Processor Test (No AI)');
    console.log('=' .repeat(40));

    try {
        // Load video data
        const videoData = JSON.parse(fs.readFileSync('videos_stream.json', 'utf8'));
        const testSample = videoData.videos.slice(0, 10); // Only 10 shows for quick test

        console.log(`📚 Testing with ${testSample.length} shows`);

        // Initialize processor without AI
        const processor = new WFGYVideoProcessor({
            threshold: 0.75,
            apiToken: null, // Disable AI for this test
            batchSize: 3,
            timeout: 10000
        });

        processor.initializeAnchors(testSample);

        // Process
        const results = await processor.processAllShows(testSample);

        // Show results
        console.log('\n📊 QUICK TEST RESULTS:');
        console.log(`   Processed: ${results.length}/${testSample.length}`);
        console.log(`   Accepted: ${processor.stats.totalAccepted}`);
        console.log(`   Rejected: ${processor.stats.totalRejected}`);
        console.log(`   Success Rate: ${((results.length / testSample.length) * 100).toFixed(1)}%`);

        // Show accepted content
        console.log('\n✅ ACCEPTED CONTENT:');
        processor.state.filtered.forEach((show, index) => {
            console.log(`${index + 1}. ${show.title} (Δ: ${show.wfgy_delta.toFixed(3)})`);
        });

        console.log('\n🎉 Quick test completed successfully!');
        return true;

    } catch (error) {
        console.error('❌ Quick test failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    quickTest();
}