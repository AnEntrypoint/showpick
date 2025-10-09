#!/usr/bin/env node

/**
 * WFGY_Core_OneLine_v2.0 Video Content Processor
 * Moral threshold-based filtering with WFGY framework integration
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
            batchSize: config.batchSize || 10,
            maxRetries: config.maxRetries || 3,
            timeout: config.timeout || 180000
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
     * Calculate cosine similarity between input and goal
     */
    calculateCosineSimilarity(input, goal) {
        if (!input || !goal) return 0;

        // Simple text similarity (can be enhanced with embeddings)
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
     * Calculate similarity estimate using WFGY weights
     */
    calculateSimilarityEstimate(input, goal, entities, relations, constraints) {
        const baseSimilarity = this.calculateCosineSimilarity(input, goal);

        // Entity similarity component
        const entitySim = entities && entities.length > 0 ?
            entities.reduce((sum, entity) => sum + this.calculateCosineSimilarity(input, entity), 0) / entities.length : 0;

        // Relation similarity component
        const relationSim = relations && relations.length > 0 ?
            relations.reduce((sum, relation) => sum + this.calculateCosineSimilarity(input, relation), 0) / relations.length : 0;

        // Constraint similarity component
        const constraintSim = constraints && constraints.length > 0 ?
            constraints.reduce((sum, constraint) => sum + this.calculateCosineSimilarity(input, constraint), 0) / constraints.length : 0;

        // Weighted combination
        const sim_est = this.config.w_e * entitySim +
                       this.config.w_r * relationSim +
                       this.config.w_c * constraintSim;

        // Renormalize to [0,1]
        return Math.max(0, Math.min(1, sim_est));
    }

    /**
     * Calculate delta_s using WFGY formula
     */
    calculateDelta(input, goal, entities = [], relations = [], constraints = []) {
        let delta;

        if (this.state.anchors.size > 0) {
            // Use similarity estimation with anchors
            const sim_est = this.calculateSimilarityEstimate(input, goal, entities, relations, constraints);
            delta = 1 - sim_est;
        } else {
            // Simple cosine similarity
            delta = 1 - this.calculateCosineSimilarity(input, goal);
        }

        return Math.max(0, Math.min(1, delta));
    }

    /**
     * Determine zone based on delta_s
     */
    getZone(delta) {
        if (delta < this.config.zones.safe) return 'safe';
        if (delta < this.config.zones.transit) return 'transit';
        if (delta < this.config.zones.risk) return 'risk';
        return 'danger';
    }

    /**
     * Update WFGY state
     */
    updateWFGYState(currentDelta, showIdentifier) {
        // Update delta history
        this.state.previousDelta = this.state.currentDelta;
        this.state.currentDelta = currentDelta;
        this.state.iteration++;

        // Check for anchor flips
        let alt = 0;
        for (let [anchor, value] of this.state.anchors) {
            const newValue = this.evaluateAnchor(showIdentifier, anchor);
            if (Math.sign(newValue) !== Math.sign(value) && Math.abs(value) > this.config.h) {
                alt = newValue > value ? 1 : -1;
                this.stats.anchorFlips++;
                this.state.anchors.set(anchor, newValue);
                break;
            }
        }

        // Calculate progress
        if (this.state.iteration === 1) {
            this.state.progress = this.config.zeta_min;
        } else {
            const deltaChange = this.state.previousDelta - this.state.currentDelta;
            this.state.progress = Math.max(this.config.zeta_min, deltaChange);
        }

        // Calculate power term
        const P = Math.pow(this.state.progress, this.config.omega);

        // Calculate phi
        const Phi = this.config.phi_delta * alt + this.config.epsilon;

        // Calculate W_c
        this.state.W_c = Math.max(-this.config.theta_c,
                         Math.min(this.config.theta_c,
                         this.config.B_c * P + Phi));

        // Determine lambda (state type)
        const Delta = this.state.currentDelta - this.state.previousDelta;
        const E_res = this.calculateRollingMean();

        if (Delta <= -0.02 && E_res >= this.state.previousDelta) {
            this.state.lambda = 'convergent';
        } else if (Math.abs(Delta) < 0.02 && Math.abs(E_res - this.state.previousDelta) < 0.01) {
            this.state.lambda = 'recursive';
        } else if (Delta > -0.02 && Delta <= 0.04 && this.state.iteration > 3) {
            this.state.lambda = 'divergent';
        } else if (Delta > 0.04 || this.hasConflictingAnchors()) {
            this.state.lambda = 'chaotic';
        }
    }

    /**
     * Calculate rolling mean for lambda determination
     */
    calculateRollingMean() {
        const window = Math.min(this.state.iteration, 5);
        const recentDeltas = this.state.memory.size > 0 ?
            Array.from(this.state.memory.values()).slice(-window) :
            [this.state.currentDelta];
        return recentDeltas.reduce((sum, delta) => sum + delta, 0) / recentDeltas.length;
    }

    /**
     * Check for conflicting anchors
     */
    hasConflictingAnchors() {
        const anchorValues = Array.from(this.state.anchors.values());
        const positives = anchorValues.filter(v => v > 0).length;
        const negatives = anchorValues.filter(v => v < 0).length;
        return positives > 0 && negatives > 0;
    }

    /**
     * Evaluate anchor for a given show
     */
    evaluateAnchor(showIdentifier, anchorType) {
        // Simple anchor evaluation - can be enhanced
        switch (anchorType) {
            case 'popularity':
                return this.state.memory.get(showIdentifier)?.downloads > 100000 ? 1 : -1;
            case 'age':
                const year = parseInt(this.state.memory.get(showIdentifier)?.date?.split('-')[0] || '2020');
                return year >= 1990 && year <= 2005 ? 1 : -1;
            case 'category':
                const category = this.state.memory.get(showIdentifier)?.category || '';
                return category.includes('gaming') || category.includes('internet') ? 1 : -1;
            default:
                return 0;
        }
    }

    /**
     * Apply BBAM (Balanced Blend And Mix) algorithm
     */
    applyBBAM(delta) {
        const W_c_norm = Math.tanh(this.state.W_c / this.config.theta_c);
        const alpha_blend_final = Math.max(0.35, Math.min(0.65,
            0.50 + this.config.k_c * W_c_norm));

        // Blend with reference (uniform distribution)
        const a_ref = 0.5; // uniform reference
        return alpha_blend_final * delta + (1 - alpha_blend_final) * a_ref;
    }

    /**
     * Make AI-powered content analysis using provided framework
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
                    model: 'glm-4.5v',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt
                                }
                            ]
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
            return this.parseAIResponse(data.choices[0].message.content, show);

        } catch (error) {
            console.warn(`AI analysis failed for ${show.title}, falling back to rule-based:`, error.message);
            return this.analyzeWithoutAI(show);
        }
    }

    /**
     * Create AI prompt for content analysis
     */
    createAIPrompt(show) {
        return `You are analyzing video content for millennial appeal using WFGY framework.

VIDEO TO ANALYZE:
Title: ${show.title}
Description: ${show.description || 'No description'}
Category: ${show.category || 'Unknown'}
Downloads: ${show.downloads || 0}
Date: ${show.date || 'Unknown'}

WFGY ANALYSIS FRAMEWORK:
Calculate delta_s = 1 - cosine_similarity(input, goal) where:
- Input: The video content above
- Goal: "Millennial entertainment value - authentic, creative, non-corporate"

CRITICAL CHARACTERISTICS:
- HIGH VALUE: 90s nostalgia, gaming culture, internet comedy, indie content, anime, cult classics
- LOW VALUE: Corporate entertainment, educational content, religious content, mainstream garbage

OUTPUT FORMAT:
DELTA_S: [number between 0-1]
ZONE: [safe/transit/risk/danger]
ENTITIES: [comma-separated key entities]
RELATIONS: [comma-separated key relationships]
CONSTRAINTS: [comma-separated content constraints]
CONFIDENCE: [1-10]
REASONING: [brief explanation]

Analyze this content for millennial appeal and provide the metrics above.`;
    }

    /**
     * Parse AI response
     */
    parseAIResponse(response, show) {
        const lines = response.split('\n');
        const result = {
            delta_s: 0.5,
            zone: 'transit',
            entities: [],
            relations: [],
            constraints: [],
            confidence: 5,
            reasoning: 'AI analysis'
        };

        lines.forEach(line => {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const [_, key, value] = match;
                switch (key.toLowerCase()) {
                    case 'delta_s':
                        result.delta_s = Math.max(0, Math.min(1, parseFloat(value) || 0.5));
                        break;
                    case 'zone':
                        result.zone = value.toLowerCase();
                        break;
                    case 'entities':
                        result.entities = value.split(',').map(e => e.trim()).filter(e => e);
                        break;
                    case 'relations':
                        result.relations = value.split(',').map(r => r.trim()).filter(r => r);
                        break;
                    case 'constraints':
                        result.constraints = value.split(',').map(c => c.trim()).filter(c => c);
                        break;
                    case 'confidence':
                        result.confidence = Math.max(1, Math.min(10, parseInt(value) || 5));
                        break;
                    case 'reasoning':
                        result.reasoning = value;
                        break;
                }
            }
        });

        return result;
    }

    /**
     * Fallback analysis without AI
     */
    analyzeWithoutAI(show) {
        const title = (show.title || '').toLowerCase();
        const description = (show.description || '').toLowerCase();
        const category = (show.category || '').toLowerCase();
        const text = `${title} ${description} ${category}`;

        // Positive indicators
        const positive = ['90s', 'gaming', 'internet', 'anime', 'indie', 'cult', 'retro', 'alternative'];
        const negative = ['disney', 'corporate', 'educational', 'religious', 'mainstream', 'family'];

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
     * Process a single video show
     */
    async processShow(show) {
        const showId = show.identifier || show.title;

        try {
            // Analyze content
            const analysis = await this.analyzeWithAI(show);

            // Update WFGY state
            this.updateWFGYState(analysis.delta_s, showId);

            // Apply BBAM
            const adjustedDelta = this.applyBBAM(analysis.delta_s);

            // Memory recording
            if (analysis.delta_s > 0.60) {
                this.state.memory.set(showId, {
                    ...show,
                    delta: adjustedDelta,
                    analysis: analysis,
                    timestamp: new Date().toISOString()
                });
            }

            // Decision making
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
                    wfgy_reasoning: `Rejected: ${analysis.reasoning}`
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

        // Confidence threshold
        if (analysis.confidence < 3) {
            return false;
        }

        // Bridge rule: allow if delta decreases and W_c < threshold
        if (this.state.iteration > 1) {
            const deltaDecrease = this.state.previousDelta > this.state.currentDelta;
            const W_c_threshold_ok = Math.abs(this.state.W_c) < (0.5 * this.config.theta_c);

            if (deltaDecrease && W_c_threshold_ok) {
                return true;
            }
        }

        // Default acceptance criteria
        return analysis.zone === 'safe' ||
               (analysis.zone === 'transit' && analysis.confidence >= 5);
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

            // Progress update
            const processed = Math.min((i + 1) * this.config.batchSize, shows.length);
            const accepted = this.stats.totalAccepted;
            const rejected = this.stats.totalRejected;
            const acceptanceRate = ((accepted / processed) * 100).toFixed(1);

            console.log(`   ✅ Processed: ${processed} | 🎯 Accepted: ${accepted} (${acceptanceRate}%) | ❌ Rejected: ${rejected}`);
            console.log(`   📈 Current state: λ=${this.state.lambda} | Δ=${this.state.currentDelta.toFixed(3)} | W_c=${this.state.W_c.toFixed(3)}`);
            console.log('');
        }

        return results;
    }

    /**
     * Generate final report
     */
    generateReport() {
        console.log('🎬 WFGY Video Processing Report');
        console.log('=' .repeat(50));

        console.log(`📊 FINAL STATISTICS:`);
        console.log(`   Total Processed: ${this.stats.totalProcessed}`);
        console.log(`   Accepted: ${this.stats.totalAccepted} (${((this.stats.totalAccepted / this.stats.totalProcessed) * 100).toFixed(1)}%)`);
        console.log(`   Rejected: ${this.stats.totalRejected} (${((this.stats.totalRejected / this.stats.totalProcessed) * 100).toFixed(1)}%)`);
        console.log(`   Average Delta: ${this.stats.averageDelta.toFixed(3)}`);
        console.log(`   Anchor Flips: ${this.stats.anchorFlips}`);
        console.log(`   Final Lambda: ${this.state.lambda}`);
        console.log(`   Final W_c: ${this.state.W_c.toFixed(3)}`);
        console.log('');

        console.log(`🎯 TOP ACCEPTED CONTENT:`);
        this.state.filtered
            .sort((a, b) => a.wfgy_delta - b.wfgy_delta)
            .slice(0, 10)
            .forEach((show, index) => {
                console.log(`${index + 1}. ${show.title}`);
                console.log(`   Δ: ${show.wfgy_delta.toFixed(3)} | Zone: ${show.wfgy_zone} | λ: ${show.wfgy_lambda}`);
                console.log(`   ${show.wfgy_reasoning}`);
                console.log('');
            });

        console.log(`❌ SAMPLE REJECTIONS:`);
        this.state.rejected
            .sort((a, b) => b.wfgy_delta - a.wfgy_delta)
            .slice(0, 5)
            .forEach((show, index) => {
                console.log(`${index + 1}. ${show.title}`);
                console.log(`   Δ: ${show.wfgy_delta.toFixed(3)} | ${show.wfgy_reasoning}`);
                console.log('');
            });

        return {
            config: this.config,
            stats: this.stats,
            state: this.state,
            filtered: this.state.filtered,
            rejected: this.state.rejected
        };
    }

    /**
     * Save results to file
     */
    saveResults(filename = 'wfgy_processed_results.json') {
        const results = this.generateReport();
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
        console.log(`💾 Results saved to ${filename}`);
        return results;
    }

    /**
     * Initialize anchors based on data characteristics
     */
    initializeAnchors(shows) {
        // Sample shows to determine anchor types
        const sample = shows.slice(0, Math.min(100, shows.length));

        // Initialize common anchors
        this.state.anchors.set('popularity', 0);
        this.state.anchors.set('age', 0);
        this.state.anchors.set('category', 0);

        console.log(`🔧 Initialized ${this.state.anchors.size} anchors for WFGY processing`);
    }
}

// Main execution
async function main() {
    try {
        // Load video data
        const videoData = JSON.parse(fs.readFileSync('videos_stream.json', 'utf8'));
        const shows = videoData.videos || [];

        console.log(`📚 Loaded ${shows.length} shows from videos_stream.json`);

        // Initialize processor
        const processor = new WFGYVideoProcessor({
            threshold: 0.75,  // Critical threshold
            apiToken: process.env.ANTHROPIC_AUTH_TOKEN,
            batchSize: 5,
            timeout: 120000
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

// Export for module usage
module.exports = WFGYVideoProcessor;

// Run if called directly
if (require.main === module) {
    main();
}