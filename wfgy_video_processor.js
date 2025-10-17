#!/usr/bin/env node

/**
 * WFGY_Core_OneLine_v2.0 Video Content Processor
 * Restored with proper z.ai API integration and improved English filtering
 */

const fs = require('fs');

class WFGYVideoProcessor {
    constructor(config = {}) {
        // WFGY Core Configuration
        this.config = {
            // Critical thresholds
            B_c: config.threshold || 0.85,                    // Boundary confidence
            gamma: config.gamma || 0.618,                    // Convergence factor
            theta_c: config.theta_c || 0.75,                 // Control threshold
            zeta_min: config.zeta_min || 0.10,              // Minimum progress
            alpha_blend: config.alpha_blend || 0.50,         // Alpha blending
            phi_delta: config.phi_delta || 0.15,             // Phase delta
            epsilon: config.epsilon || 0,                    // Epsilon for numerical stability
            k_c: config.k_c || 0.25,                        // Coupling constant
            omega: config.omega || 1,                        // Progress exponent
            h: config.h || 0.02,                             // Anchor flip threshold

            // Similarity weights
            w_e: config.w_e || 0.5,                          // Entity similarity weight
            w_r: config.w_r || 0.3,                          // Relation similarity weight
            w_c: config.w_c || 0.2,                          // Constraint similarity weight

            // Zones
            zones: {
                safe: config.safe_zone || 0.40,
                transit: config.transit_zone || 0.60,
                risk: config.risk_zone || 0.85,
                danger: config.danger_zone || 1.0
            },

            // API Configuration (from provided framework)
            apiEndpoint: config.apiEndpoint || 'https://api.z.ai/api/coding/paas/v4/chat/completions',
            apiToken: config.apiToken || process.env.ANTHROPIC_AUTH_TOKEN,

            // Processing configuration
            batchSize: config.batchSize || 5,                 // Smaller batches for AI processing
            maxRetries: config.maxRetries || 3,
            timeout: config.timeout || 120000                 // 2 minutes per request
        };

        // State management
        this.state = {
            processed: [],
            filtered: [],
            rejected: [],
            memory: new Map(),
            anchors: new Map(),
            currentDelta: 0,
            previousDelta: 0,
            progress: this.config.zeta_min,
            iteration: 0,
            W_c: 0,
            lambda: 'convergent'
        };

        // Statistics
        this.stats = {
            totalProcessed: 0,
            totalAccepted: 0,
            totalRejected: 0,
            averageDelta: 0,
            convergenceRate: 0,
            anchorFlips: 0
        };

      }

  
    /**
     * Initialize WFGY anchors
     */
    initializeAnchors(shows) {
        console.log('🔧 Initializing WFGY anchors...');

        // Set initial anchors based on content analysis
        this.state.anchors.set('content_quality', 0.5);
        this.state.anchors.set('entertainment_value', 0.5);
        this.state.anchors.set('millennial_appeal', 0.5);

        console.log(`✅ Initialized ${this.state.anchors.size} anchors`);
    }

    /**
     * Update WFGY state with new delta
     */
    updateWFGYState(delta_s, showId) {
        this.state.previousDelta = this.state.currentDelta;
        this.state.currentDelta = delta_s;

        // Check for anchor flips
        if (this.state.iteration > 0) {
            const deltaChange = Math.abs(delta_s - this.state.previousDelta);
            if (deltaChange >= this.config.h) {
                this.stats.anchorFlips++;
                // Flip lambda state
                this.state.lambda = this.state.lambda === 'convergent' ? 'divergent' : 'convergent';
            }
        }

        this.state.iteration++;
    }

    /**
     * Apply BBAM (Boundary-based Adaptive Adjustment)
     */
    applyBBAM(delta_s) {
        const P = Math.pow(this.state.progress, this.config.omega);
        const alt = this.state.lambda === 'convergent' ? 1 : -1;
        const Phi = this.config.phi_delta * alt + this.config.epsilon;
        const W_c = Math.max(-this.config.theta_c, Math.min(this.config.theta_c, delta_s * P + Phi));

        return Math.max(0, Math.min(1, delta_s + W_c * 0.1));
    }

    /**
     * Calculate cosine similarity between input and goal
     */
    calculateCosineSimilarity(input, goal) {
        if (!input || !goal) return 0;

        const inputTokens = this.tokenize(input.toLowerCase());
        const goalTokens = this.tokenize(goal.toLowerCase());

        const intersection = new Set([...inputTokens].filter(x => goalTokens.has(x)));
        const union = new Set([...inputTokens, ...goalTokens]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Tokenize text for similarity calculation
     */
    tokenize(text) {
        return new Set(text.split(/\s+/).filter(word => word.length > 2));
    }

    /**
     * Determine zone based on delta_s
     */
    getZone(delta_s) {
        if (delta_s < this.config.zones.safe) return 'safe';
        if (delta_s < this.config.zones.transit) return 'transit';
        if (delta_s < this.config.zones.risk) return 'risk';
        return 'danger';
    }

    /**
     * Create AI prompt for comprehensive content analysis
     */
    createAIPrompt(show) {
        // Build comprehensive metadata string
        const metadata = [];

        // Basic info
        if (show.title) metadata.push(`TITLE: ${show.title}`);
        if (show.description) metadata.push(`DESCRIPTION: ${show.description}`);
        if (show.creator) metadata.push(`CREATOR: ${show.creator}`);
        if (show.category) metadata.push(`CATEGORY: ${show.category}`);

        // Video files info
        if (show.videoFiles && show.videoFiles.length > 0) {
            metadata.push(`VIDEO COUNT: ${show.videoFiles.length}`);
            const durations = show.videoFiles.map(f => f.durationMs).filter(d => d);
            if (durations.length > 0) {
                const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
                metadata.push(`AVERAGE DURATION: ${(avgDuration / 60000).toFixed(1)} minutes`);
            }
        }

        // Temporal info
        if (show.year || show.date) {
            metadata.push(`YEAR: ${show.year || show.date}`);
        }

        // Popularity metrics
        if (show.downloads) {
            metadata.push(`DOWNLOADS: ${show.downloads.toLocaleString()}`);
        }

        const metadataText = metadata.join('\n');

        return `You are an intelligent content analyst using the WFGY framework. Evaluate this video collection for inclusion in a 24/7 streaming TV schedule targeting millennial audiences.

CONTENT METADATA:
${metadataText}

Your task is to determine if this content is suitable for programming. Consider ALL factors that matter:

- Language accessibility (is it primarily in English?)
- Entertainment value and engagement potential
- Content appropriateness for streaming
- Millennial appeal and cultural relevance
- Production quality and watchability
- Any content that should be excluded (explicit material, copyrighted issues, etc.)
- Overall suitability for a curated TV schedule

Rate this content on a scale of 1-10 where:
1 = EXCELLENT for streaming - highly entertaining, perfect fit
5 = MODERATE appeal - some potential but questionable
10 = POOR fit - not suitable for programming

Make intelligent decisions based on the content metadata. You can reject content for any valid reason including language barriers, quality issues, or inappropriate material.

Respond with only a single number between 1-10.`;
    }

    /**
     * Make AI-powered content analysis using z.ai API
     */
    async analyzeWithAI(show) {
        if (!this.config.apiToken) {
            return this.analyzeWithoutAI(show);
        }

        try {
            const prompt = this.createAIPrompt(show);

            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'glm-4.5-air',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 1000,
                    temperature: 0.2
                }),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const aiResponse = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) ? data.choices[0].message.content.trim() : (typeof data === 'string' ? data.trim() : '');

            // Extract rating from AI response (expect a single number 1-10)
            const match = aiResponse.match(/\b(?:10|[1-9])\b/);
            const rating = match ? parseInt(match[0], 10) : 5;

            // Directly use the AI's numeric output as the basis for delta
            const delta_s = (rating - 1) / 9; // Normalize to 0-1
            const zone = this.getZone(delta_s);

            console.log(`✅ AI analysis complete: ${show.title} - Rating: ${rating}/10, Δ: ${delta_s.toFixed(3)}, Zone: ${zone}`);

            return {
                delta_s,
                zone,
                rating,
                confidence: null,
                reasoning: `Rating ${rating}/10`
            };

        } catch (error) {
            console.error(`❌ AI analysis failed for ${show.title}:`, error.message);
            throw new Error(`AI analysis required and failed: ${error.message}`);
        }
    }

    /**
     * Fallback analysis without AI
     */
    analyzeWithoutAI(show) {
        const title = (show.title || '').toLowerCase();
        const description = (show.description || '').toLowerCase();
        const category = (show.category || '').toLowerCase();
        const text = `${title} ${description} ${category}`;

        // Simple rule-based scoring
        const positive = ['funny', 'comedy', 'humor', 'entertainment', 'meme', 'viral', 'trending', 'popular'];
        const negative = ['boring', 'dull', 'serious', 'educational', 'documentary'];

        let score = 0;
        positive.forEach(term => {
            if (text.includes(term)) score += 0.1;
        });
        negative.forEach(term => {
            if (text.includes(term)) score -= 0.1;
        });

        const delta = Math.max(0, Math.min(1, 1 - (score + 1) / 2));

        return {
            delta_s: delta,
            zone: this.getZone(delta),
            entities: [],
            relations: [],
            constraints: [],
            confidence: 3,
            reasoning: 'Rule-based analysis'
        };
    }

    /**
     * Process a single video show - AI makes all filtering decisions
     */
    async processShow(show) {
        const showId = show.identifier || show.title;

        try {
            // Analyze content with AI - AI returns a numeric rating which we use directly
            const analysis = await this.analyzeWithAI(show);

            // Update WFGY state
            this.updateWFGYState(analysis.delta_s, showId);

            // Use AI output number directly (no BBAM adjustment)
            const adjustedDelta = analysis.delta_s;

            // Memory recording (keep high-rated items)
            if (analysis.delta_s > 0.60) {
                this.state.memory.set(showId, {
                    ...show,
                    delta: adjustedDelta,
                    analysis: analysis,
                    timestamp: new Date().toISOString()
                });
            }

            // Decision based solely on delta and zone
            const passes = this.evaluateDecision(adjustedDelta, analysis);

            if (passes) {
                this.state.filtered.push({
                    ...show,
                    wfgy_delta: adjustedDelta,
                    wfgy_zone: analysis.zone,
                    wfgy_confidence: analysis.confidence,
                    wfgy_reasoning: analysis.reasoning,
                    wfgy_lambda: this.state.lambda,
                    wfgy_iteration: this.state.iteration
                });
                this.stats.totalAccepted++;
            } else {
                this.state.rejected.push({
                    ...show,
                    wfgy_delta: adjustedDelta,
                    wfgy_zone: analysis.zone,
                    wfgy_reasoning: `AI rejected: ${analysis.reasoning}`
                });
                this.stats.totalRejected++;
            }

            this.stats.totalProcessed++;
            this.stats.averageDelta = (this.stats.averageDelta * (this.stats.totalProcessed - 1) + adjustedDelta) / this.stats.totalProcessed;

            return {
                show: show.title,
                delta: adjustedDelta,
                zone: analysis.zone,
                passed: passes,
                iteration: this.state.iteration,
                lambda: this.state.lambda
            };

        } catch (error) {
            console.error(`Error processing show ${show.title}:`, error.message);
            this.stats.totalRejected++;
            return null;
        }
    }

    /**
     * Evaluate final decision based on WFGY criteria
     */
    evaluateDecision(delta, analysis) {
        // Primary threshold check
        if (delta > this.config.B_c) {
            return false;
        }

        // Zone-based filtering
        if (analysis.zone === 'danger') {
            return false;
        }

        return true;
    }

    /**
     * Process all shows in batch
     */
    async processAllShows(shows) {
        console.log('🎬 WFGY Video Content Processor Starting...');
        console.log(`📊 Processing ${shows.length} shows with threshold ${this.config.B_c}`);
        console.log(`🧠 AI Analysis: ${this.config.apiToken ? 'Enabled' : 'Disabled (Rule-based fallback)'}`);
        console.log('');

        const results = [];
        const batches = Math.ceil(shows.length / this.config.batchSize);

        for (let i = 0; i < batches; i++) {
            const start = i * this.config.batchSize;
            const end = Math.min(start + this.config.batchSize, shows.length);
            const batch = shows.slice(start, end);

            console.log(`📦 Processing batch ${i + 1}/${batches} (${batch.length} shows)...`);

            const batchPromises = batch.map(show => this.processShow(show));
            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                } else {
                    console.warn(`⚠️ Failed to process: ${batch[index].title}`);
                }
            });

            // Update progress
            this.state.progress = Math.min(1.0, this.config.zeta_min + (i + 1) / batches * (1 - this.config.zeta_min));

            // Brief pause between batches to avoid API rate limits
            if (i < batches - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('');
        console.log('📊 Processing Summary:');
        console.log(`   Total processed: ${this.stats.totalProcessed.toLocaleString()}`);
        console.log(`   Accepted: ${this.stats.totalAccepted.toLocaleString()}`);
        console.log(`   Rejected: ${this.stats.totalRejected.toLocaleString()}`);
        console.log(`   Acceptance rate: ${(this.stats.totalAccepted / this.stats.totalProcessed * 100).toFixed(1)}%`);
        console.log(`   Average delta: ${this.stats.averageDelta.toFixed(3)}`);
        console.log(`   Anchor flips: ${this.stats.anchorFlips}`);

        return results;
    }

    /**
     * Save results to files
     */
    saveResults() {
        const outputFile = 'videos_stream_filtered.json';

        const outputData = {
            generated: new Date().toISOString(),
            wfgy_framework: "WFGY_Core_OneLine_v2.0",
            total_collections: this.stats.totalProcessed,
            filtered_collections: this.stats.totalAccepted,
            filter_method: "AI-intelligent filtering (all decisions made by AI)",
            ai_analysis: this.config.apiToken ? "enabled" : "disabled",
            videos: this.state.filtered
        };

        console.log(`💾 Saving filtered data to ${outputFile}...`);
        fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));

        // Calculate video statistics
        let totalVideos = 0;
        let mp4Videos = 0;
        this.state.filtered.forEach(collection => {
            if (collection.videoFiles) {
                totalVideos += collection.videoFiles.length;
                collection.videoFiles.forEach(file => {
                    if (file.name && file.name.toLowerCase().endsWith('.mp4')) {
                        mp4Videos++;
                    }
                });
            }
        });

        console.log(`📊 Output statistics:`);
        console.log(`   Collections: ${this.stats.totalAccepted.toLocaleString()}`);
        console.log(`   Total videos: ${totalVideos.toLocaleString()}`);
        console.log(`   MP4 videos: ${mp4Videos.toLocaleString()}`);
    }

    /**
     * Main processing function
     */
    async process() {
        try {
            console.log('🎬 WFGY Video Content Processor - Core OneLine v2.0');
            console.log('=====================================================');
            console.log(`📂 Loading video data from videos_stream.json...`);

            if (!fs.existsSync('videos_stream.json')) {
                throw new Error('Input file not found: videos_stream.json');
            }

            const data = JSON.parse(fs.readFileSync('videos_stream.json', 'utf8'));
            const shows = data.videos;
            console.log(`📁 Loaded ${shows.length} collections`);

            // Initialize processor
            const processor = new WFGYVideoProcessor({
                threshold: 0.85,  // Critical threshold
                apiToken: process.env.ANTHROPIC_AUTH_TOKEN,
                batchSize: 3,     // Small batches for AI processing
                timeout: 180000   // 3 minutes per request
            });

            // Initialize anchors
            processor.initializeAnchors(shows);

            // Process all shows
            await processor.processAllShows(shows);

            // Generate and save results
            processor.saveResults();

            console.log('🎉 WFGY Video Processing Complete!');

        } catch (error) {
            console.error('❌ Processing failed:', error.message);
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    const processor = new WFGYVideoProcessor();
    await processor.process();
}

// Export for module usage
module.exports = WFGYVideoProcessor;

// Run if called directly
if (require.main === module) {
    main();
}