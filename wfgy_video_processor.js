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
            throw new Error('API token is required - no fallback to rule-based analysis allowed');
        }

        console.log(`🤖 Analyzing with GLM-4.5-air: ${show.title}`);

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
            const message = data.choices[0].message;

            // Check both reasoning_content and content fields for the rating
            const reasoningContent = message.reasoning_content || '';
            const regularContent = message.content || '';

            // Look for rating in the content field first (where GLM-4.5-air puts the final answer)
            let numberMatch = regularContent.match(/^\s*([0-9]|10)\s*$/);
            let rating = numberMatch ? parseInt(numberMatch[0]) : null;

            // If not found in content field, look in reasoning_content for the final rating
            if (rating === null) {
                // Look for patterns like "So, I'll go with 2" or "rating: 3" near the end
                const finalMatch = reasoningContent.match(/(?:go with|rating[^:]*:?\s*|final[^:]*:?\s*|answer[^:]*:?\s*)\s*([0-9]|10)\b/gi);
                if (finalMatch) {
                    // Extract the number from the last match
                    const lastMatch = finalMatch[finalMatch.length - 1];
                    const extractedNumber = lastMatch.match(/\b([0-9]|10)\b/);
                    if (extractedNumber) {
                        rating = parseInt(extractedNumber[0]);
                    }
                }
            }

            // Fallback: look for any number if specific patterns don't work
            if (rating === null) {
                const allNumbers = (reasoningContent + regularContent).match(/\b([0-9]|10)\b/g);
                if (allNumbers && allNumbers.length > 0) {
                    // Use the last number found (likely to be the final answer)
                    rating = parseInt(allNumbers[allNumbers.length - 1]);
                }
            }

            // Default if still not found
            if (rating === null) {
                rating = 5;
            }

            const delta_s = rating / 10;

            // Quick zone calculation
            let zone;
            if (delta_s < 0.40) zone = 'safe';
            else if (delta_s < 0.60) zone = 'transit';
            else if (delta_s < 0.85) zone = 'risk';
            else zone = 'danger';

            const result = {
                delta_s: delta_s,
                zone: zone,
                entities: [],
                relations: [],
                constraints: [],
                confidence: rating <= 3 ? 9 : (rating <= 6 ? 7 : 5),
                reasoning: `AI analysis: ${show.title} - Rating ${rating}/10`
            };

            console.log(`✅ AI analysis complete: ${show.title} - Δ: ${result.delta_s.toFixed(3)}, Zone: ${result.zone}`);

            return result;

        } catch (error) {
            console.error(`❌ AI analysis failed for ${show.title}:`, error.message);
            throw new Error(`AI analysis required and failed: ${error.message}`);
        }
    }

    /**
     * Create AI prompt for content analysis with full metadata
     */
    createAIPrompt(show) {
        // Build comprehensive metadata string
        const metadata = [];

        // Basic info
        if (show.title) metadata.push(`TITLE: ${show.title}`);
        if (show.description) metadata.push(`DESCRIPTION: ${show.description}`);
        if (show.category) metadata.push(`CATEGORY: ${show.category}`);

        // Genres and themes
        if (show.genres && show.genres.length > 0) {
            metadata.push(`GENRES: ${show.genres.join(', ')}`);
        }
        if (show.keywords && show.keywords.length > 0) {
            metadata.push(`KEYWORDS: ${show.keywords.join(', ')}`);
        }
        if (show.themes && show.themes.length > 0) {
            metadata.push(`THEMES: ${show.themes.join(', ')}`);
        }

        // Temporal info
        if (show.year || show.date) {
            metadata.push(`YEAR: ${show.year || show.date}`);
        }
        if (show.decade) metadata.push(`DECADE: ${show.decade}`);
        if (show.era) metadata.push(`ERA: ${show.era}`);

        // Ratings and popularity
        if (show.rating) metadata.push(`RATING: ${show.rating}/10`);
        if (show.imdb_rating) metadata.push(`IMDB: ${show.imdb_rating}/10`);
        if (show.views || show.downloads) {
            metadata.push(`POPULARITY: ${show.views || show.downloads}`);
        }
        if (show.maturity) metadata.push(`MATURITY: ${show.maturity}`);

        // Production info
        if (show.studio || show.network) {
            metadata.push(`PRODUCED BY: ${show.studio || show.network}`);
        }
        if (show.director) metadata.push(`DIRECTOR: ${show.director}`);
        if (show.cast && show.cast.length > 0) {
            metadata.push(`CAST: ${show.cast.slice(0, 3).join(', ')}`);
        }

        // Additional context
        if (show.platform) metadata.push(`PLATFORM: ${show.platform}`);
        if (show.language) metadata.push(`LANGUAGE: ${show.language}`);
        if (show.country) metadata.push(`COUNTRY: ${show.country}`);
        if (show.duration) metadata.push(`DURATION: ${show.duration}`);

        // Cultural context
        if (show.cultural_impact) metadata.push(`CULTURAL IMPACT: ${show.cultural_impact}`);
        if (show.nostalgia_factor) metadata.push(`NOSTALGIA: ${show.nostalgia_factor}/10`);
        if (show.anti_corporate) metadata.push(`ANTI-CORPORATE: ${show.anti_corporate}`);

        return `RATE 0-10 FOR MILLENNIAL APPEAL (0=extremely cool, 10=completely lame):

${metadata.join('\n')}

MILLENNIAL PREFERENCES:
• HIGH APPEAL (0-3): 90s nostalgia, gaming culture, internet comedy, indie content, anti-corporate, cult classics, alternative media, early internet, retro tech
• MEDIUM APPEAL (4-6): Some mainstream appeal, balanced content, moderate nostalgia
• LOW APPEAL (7-10): Corporate media, educational content, religious programming, family-friendly, mainstream entertainment, Disney content

RESPOND WITH ONLY A SINGLE NUMBER 0-10`;
    }

    /**
     * Parse AI response - extract 0-10 rating and convert to delta
     */
    parseAIResponse(response, show) {
        // Look for numbers between 0-10
        const numberMatch = response.match(/\b([0-9]|10)\b/);
        let rating = 5; // default

        if (numberMatch) {
            rating = parseInt(numberMatch[0]);
        }

        // Convert 0-10 rating to 0-1 delta (inverse scale)
        // 0 = best appeal, 10 = worst appeal
        const delta_s = Math.max(0, Math.min(1, rating / 10));

        // Determine zone based on delta
        let zone;
        if (delta_s < 0.40) zone = 'safe';
        else if (delta_s < 0.60) zone = 'transit';
        else if (delta_s < 0.85) zone = 'risk';
        else zone = 'danger';

        // Calculate confidence based on rating
        let confidence = 5;
        if (rating <= 3) confidence = 9;
        else if (rating <= 5) confidence = 7;
        else if (rating <= 7) confidence = 5;
        else confidence = 3;

        // Generate reasoning based on rating
        let reasoning = `AI analysis: ${show.title} `;
        if (rating <= 3) {
            reasoning += 'has very high millennial appeal';
        } else if (rating <= 6) {
            reasoning += 'has good millennial appeal';
        } else if (rating <= 8) {
            reasoning += 'has moderate millennial appeal';
        } else {
            reasoning += 'has limited millennial appeal';
        }

        return {
            delta_s: delta_s,
            zone: zone,
            entities: [],
            relations: [],
            constraints: [],
            confidence: confidence,
            reasoning: reasoning
        };
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
        console.log(`🧠 AI Analysis: ${this.config.apiToken ? 'GLM-4.5-air ONLY (No fallback)' : 'ERROR: No API token'}`);
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