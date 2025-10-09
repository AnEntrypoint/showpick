#!/usr/bin/env node

/**
 * Test script for LLM-only processing (no fallbacks)
 */

const fs = require('fs');
const WFGYVideoProcessor = require('./wfgy_video_processor');

async function testLLMOnly() {
    console.log('🧪 LLM-Only Test (No Fallbacks)');
    console.log('=' .repeat(40));

    try {
        // Load video data
        const videoData = JSON.parse(fs.readFileSync('videos_stream.json', 'utf8'));
        const testSample = videoData.videos.slice(0, 3); // Just 3 shows for testing

        console.log(`📚 Testing with ${testSample.length} shows`);

        // Initialize processor with LLM-only mode
        const processor = new WFGYVideoProcessor({
            threshold: 0.75,
            apiToken: process.env.ANTHROPIC_AUTH_TOKEN,
            batchSize: 1, // Process one at a time to see each response
            timeout: 30000 // 30 seconds timeout
        });

        processor.initializeAnchors(testSample);

        // Process one show at a time to see responses
        console.log('\n🚀 Starting LLM-only processing...\n');

        for (let i = 0; i < testSample.length; i++) {
            const show = testSample[i];
            console.log(`\n📦 Processing show ${i + 1}/${testSample.length}: ${show.title}`);

            try {
                const result = await processor.processShow(show);
                if (result) {
                    console.log(`✅ Success: ${result.show}`);
                    console.log(`   Δ: ${result.delta.toFixed(3)} | Zone: ${result.zone} | Passed: ${result.passed}`);
                    console.log(`   Lambda: ${result.lambda} | Iteration: ${result.iteration}`);
                } else {
                    console.log(`❌ Failed to process: ${show.title}`);
                }
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }

        // Show final stats
        console.log('\n📊 FINAL RESULTS:');
        console.log(`   Processed: ${processor.stats.totalProcessed}`);
        console.log(`   Accepted: ${processor.stats.totalAccepted}`);
        console.log(`   Rejected: ${processor.stats.totalRejected}`);
        console.log(`   Average Delta: ${processor.stats.averageDelta.toFixed(3)}`);
        console.log(`   Final Lambda: ${processor.state.lambda}`);

        console.log('\n🎉 LLM-only test completed!');
        return processor.stats.totalProcessed === testSample.length;

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        return false;
    }
}

if (require.main === module) {
    testLLMOnly()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testLLMOnly };