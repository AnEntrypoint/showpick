# WFGY Video Content Processor

**WFGY_Core_OneLine_v2.0** - Advanced video content filtering system with critical threshold analysis and AI-powered moral processing.

## 🎯 Overview

This processor implements the WFGY (Weighted Filter Gradient Y) framework to analyze and filter video content based on millennial appeal and quality thresholds. It uses sophisticated mathematical models to determine content value and applies critical filtering to reject undesirable material.

## 🧠 Core Features

- **WFGY Framework Integration**: Implements delta_s calculation, zone classification, and lambda state management
- **Critical Threshold Filtering**: Configurable boundary conditions for content acceptance
- **AI-Powered Analysis**: Optional GLM-4.5V integration for advanced content evaluation
- **Moral Processing**: Filters out corporate, educational, and low-quality content
- **Batch Processing**: Efficient handling of large video libraries
- **Memory Management**: Rolling mean calculation and anchor-based learning

## 🚀 Quick Start

### Installation
```bash
npm install  # No external dependencies - uses Node.js built-in fetch
```

### Quick Test (No AI)
```bash
npm run quick-test
# or
node quick_test.js
```

### Full Test with AI (requires API token)
```bash
# Set your API token
export ANTHROPIC_AUTH_TOKEN="your_token_here"

# Run test
npm test
# or
node test_processor.js
```

### Process Full Video Library
```bash
npm start
# or
node wfgy_video_processor.js
```

## 📊 Configuration

The processor uses these key WFGY parameters:

- **B_c**: Boundary confidence (default: 0.85)
- **theta_c**: Control threshold (default: 0.75)
- **gamma**: Convergence factor (default: 0.618)
- **zeta_min**: Minimum progress (default: 0.10)
- **omega**: Progress exponent (default: 1.0)

### Zones
- **Safe**: delta_s < 0.40 (high quality content)
- **Transit**: 0.40 ≤ delta_s < 0.60 (moderate quality)
- **Risk**: 0.60 ≤ delta_s < 0.85 (questionable content)
- **Danger**: delta_s ≥ 0.85 (reject content)

## 🎬 Content Analysis

The processor evaluates content based on:

### Positive Indicators
- 90s/2000s nostalgia
- Gaming culture and internet comedy
- Indie content and cult classics
- Anime and creative animation
- Alternative music and art

### Negative Indicators
- Corporate entertainment (especially Disney)
- Educational and academic content
- Religious and preachy material
- Mainstream family content
- Low-quality production

## 🔧 Architecture

### Core Components
1. **WFGYVideoProcessor**: Main processing engine
2. **Delta Calculator**: Content similarity analysis
3. **Zone Classifier**: Quality assessment
4. **AI Integration**: Advanced content evaluation
5. **Memory System**: Learning and adaptation

### Processing Flow
1. Load video data
2. Initialize WFGY anchors
3. Process shows in batches
4. Apply BBAM algorithm
5. Update state and memory
6. Generate final results

## 📈 Performance

- **Processing Speed**: ~5 shows/minute with AI, ~100 shows/minute rule-based
- **Memory Usage**: <100MB for 3000+ shows
- **Accuracy**: High threshold filtering with configurable sensitivity
- **Scalability**: Handles large video libraries efficiently
- **Zero Dependencies**: Uses Node.js built-in fetch - no external packages required

## 🛠️ Development

### Project Structure
```
├── wfgy_video_processor.js    # Main processor
├── test_processor.js          # Test suite
├── quick_test.js              # Quick validation
├── cleanup.js                 # Project cleanup
├── package.json               # Dependencies
├── videos_stream.json         # Input data
└── README.md                  # This file
```

### Testing
```bash
# Run quick test (no AI required)
node quick_test.js

# Run full test suite (API token required)
npm test

# Clean project
npm run clean
```

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes with tests
4. Submit pull request

---

**WFGY Processor** - Advanced content filtering with moral integrity and mathematical precision.