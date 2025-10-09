#!/usr/bin/env node

/**
 * Test script for WFGY Video Processor
 * Performs a small-scale test before full deployment
 */

const fs = require('fs');
const WFGYVideoProcessor = require('./wfgy_video_processor');

async function runTest() {
    console.log('🧪 WFGY Video Processor Test Run');
    console.log('=' .repeat(40));

    try {
        // Load video data
        const videoData = JSON.parse(fs.readFileSync('videos_stream.json', 'utf8'));
        const allShows = videoData.videos || [];

        console.log(`📚 Loaded ${allShows.length} total shows`);

        // Create test sample (first 50 shows for quick test)
        const testSample = allShows.slice(0, 50);
        console.log(`🧪 Using test sample of ${testSample.length} shows`);

        // Initialize processor with test configuration
        const processor = new WFGYVideoProcessor({
            threshold: 0.75,  // Critical threshold for testing
            apiToken: process.env.ANTHROPIC_AUTH_TOKEN, // Use if available
            batchSize: 5,      // Small batch for testing
            timeout: 60000,    // 1 minute timeout
            B_c: 0.75,         // Boundary confidence
            theta_c: 0.75,     // Control threshold
            safe_zone: 0.40,
            transit_zone: 0.60,
            risk_zone: 0.85
        });

        // Initialize anchors
        processor.initializeAnchors(testSample);

        // Process test sample
        console.log('\n🚀 Starting test processing...\n');
        const results = await processor.processAllShows(testSample);

        // Generate test report
        console.log('\n📊 TEST RESULTS:');
        const report = processor.generateReport();

        // Save test results
        const testResults = {
            testConfig: {
                sampleSize: testSample.length,
                threshold: 0.75,
                timestamp: new Date().toISOString()
            },
            ...report
        };

        fs.writeFileSync('test_results.json', JSON.stringify(testResults, null, 2));
        console.log('💾 Test results saved to test_results.json');

        // Test validation
        console.log('\n✅ TEST VALIDATION:');
        console.log(`   Processed shows: ${testSample.length}`);
        console.log(`   Results generated: ${results.length}`);
        console.log(`   Accepted shows: ${report.stats.totalAccepted}`);
        console.log(`   Rejected shows: ${report.stats.totalRejected}`);
        console.log(`   Acceptance rate: ${((report.stats.totalAccepted / testSample.length) * 100).toFixed(1)}%`);

        // Check if processing completed successfully
        if (report.stats.totalProcessed === testSample.length) {
            console.log('\n🎉 TEST PASSED: All shows processed successfully');
            return true;
        } else {
            console.log('\n❌ TEST FAILED: Not all shows were processed');
            return false;
        }

    } catch (error) {
        console.error('\n❌ TEST ERROR:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run test
if (require.main === module) {
    runTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

module.exports = { runTest };