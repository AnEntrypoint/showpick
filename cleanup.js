#!/usr/bin/env node

/**
 * Cleanup script for WFGY Video Processor project
 * Removes old analysis files and prepares for testing
 */

const fs = require('fs');
const path = require('path');

function cleanup() {
    console.log('🧹 Cleaning up project files...');

    // Files to remove
    const filesToRemove = [
        'analyze_shows.js',
        'simple_analysis.js',
        'ai_video_analyzer.js',
        'real_millennial_analyzer.js',
        'show_analysis.json',
        'video_analysis.json',
        'millennial_library_analysis.json',
        'millennial_video_library_report.md',
        'ai_millennial_analysis.json',
        'real_millennial_analysis.json',
        'test_results.json',
        'wfgy_processed_results.json'
    ];

    // Remove files if they exist
    filesToRemove.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`   ✅ Removed: ${file}`);
            } catch (error) {
                console.log(`   ⚠️ Could not remove: ${file} (${error.message})`);
            }
        } else {
            console.log(`   ℹ️ Not found: ${file}`);
        }
    });

    // Keep essential files
    const essentialFiles = [
        'package.json',
        'wfgy_video_processor.js',
        'test_processor.js',
        'cleanup.js',
        'videos_stream.json'  // Original data file
    ];

    console.log('\n📁 Essential files retained:');
    essentialFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ⚠️ Missing: ${file}`);
        }
    });

    console.log('\n🎉 Cleanup complete! Project ready for testing.');
    console.log('\n📋 Next steps:');
    console.log('   1. Install dependencies: npm install');
    console.log('   2. Run test: npm test');
    console.log('   3. Run full processing: npm start');
}

// Run cleanup
if (require.main === module) {
    cleanup();
}

module.exports = { cleanup };