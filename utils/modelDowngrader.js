// utils/modelDowngrader.js
class ModelDowngrader {
    constructor() {
        // Track rate limits per model
        this.modelStatus = {
            'gpt-4o-mini': { isLimited: false, lastLimitHit: 0 },
            'gpt-4o': { isLimited: false, lastLimitHit: 0 },
            'gpt-4-turbo': { isLimited: false, lastLimitHit: 0 },
            'gpt-4': { isLimited: false, lastLimitHit: 0 },
            'gpt-3.5-turbo': { isLimited: false, lastLimitHit: 0 }
        };
        
        // Define fallback chain according to your specification
        this.fallbackChain = {
            'gpt-4o-mini': 'gpt-4o',
            'gpt-4o': 'gpt-4-turbo',
            'gpt-4-turbo': 'gpt-4',
            'gpt-4': 'gpt-3.5-turbo',
            'gpt-3.5-turbo': null // No fallback
        };
        
        // Reset limits after cooldown period
        setInterval(this.resetLimits.bind(this), 3600000); // Check every hour
    }
    
    // Record a rate limit hit for a model
    recordRateLimit(model) {
        if (this.modelStatus[model]) {
            this.modelStatus[model].isLimited = true;
            this.modelStatus[model].lastLimitHit = Date.now();
            console.log(`⚠️ Rate limit hit for ${model}, activating fallback chain`);
        }
    }
    
    // Reset limits that have cooled down (24 hours)
    resetLimits() {
        const now = Date.now();
        const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
        
        Object.keys(this.modelStatus).forEach(model => {
            if (this.modelStatus[model].isLimited && 
                (now - this.modelStatus[model].lastLimitHit) > cooldownPeriod) {
                this.modelStatus[model].isLimited = false;
                console.log(`✅ Cooldown complete for ${model}, resetting rate limit status`);
            }
        });
    }
    
    // Get appropriate model based on rate limit status
    getAvailableModel(requestedModel) {
        // Default to gpt-4o-mini if no valid model requested
        let model = requestedModel || 'gpt-4o-mini';
        
        // If model doesn't exist in our tracking, use gpt-4o-mini
        if (!this.modelStatus[model]) {
            return 'gpt-4o-mini';
        }
        
        // If requested model is rate limited, follow fallback chain
        while (this.modelStatus[model]?.isLimited && this.fallbackChain[model]) {
            model = this.fallbackChain[model];
        }
        
        return model;
    }
}

module.exports = new ModelDowngrader();