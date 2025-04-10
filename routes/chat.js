const express = require('express');
const router = express.Router();
const openaiClient = require('../config/openai');
const modelDowngrader = require('../utils/modelDowngrader');

router.post('/chat', async (req, res) => {
    try {
        // Extract the requested model, defaulting to gpt-4o-mini if none specified
        let requestedModel = req.body.model || req.body.Model || 'gpt-4o-mini';
        
        // Get available model (may be downgraded if rate limited)
        const model = modelDowngrader.getAvailableModel(requestedModel);
        
        // Log model choice if it was changed
        if (model !== requestedModel) {
            console.log(`ℹ️ Request for ${requestedModel} downgraded to ${model} due to rate limits`);
        }
        
        // Prepare messages the way OpenAI expects
        const messages = (req.body.messages || req.body.Messages || []).map(msg => ({
            role: msg.role || msg.Role,
            content: msg.content || msg.Content
        }));
        
        // Build the request body
        const body = {
            model: model,
            messages: messages,
            temperature: req.body.temperature || req.body.Temperature || 0.7
        };
        
        // Send request to OpenAI
        const response = await openaiClient.post('/chat/completions', body);
        
        // Return the response
        res.json(response.data);
        
    } catch (error) {
        // Check if this was a rate limit error
        if (error.response?.status === 429 && req.body.model) {
            // Record rate limit for this model
            modelDowngrader.recordRateLimit(req.body.model);
            
            // Retry with fallback model
            try {
                const fallbackModel = modelDowngrader.getAvailableModel(req.body.model);
                
                // Only retry if we have a different model
                if (fallbackModel && fallbackModel !== req.body.model) {
                    console.log(`🔄 Retrying request with fallback model ${fallbackModel}`);
                    
                    const messages = (req.body.messages || req.body.Messages || []).map(msg => ({
                        role: msg.role || msg.Role,
                        content: msg.content || msg.Content
                    }));
                    
                    const retryBody = {
                        model: fallbackModel,
                        messages: messages,
                        temperature: req.body.temperature || req.body.Temperature || 0.7
                    };
                    
                    const retryResponse = await openaiClient.post('/chat/completions', retryBody);
                    return res.json(retryResponse.data);
                }
            } catch (retryError) {
                // Log retry failure but continue to error handling
                console.error(`❌ Retry with fallback model failed:`, retryError.message);
            }
        }
        
        // Handle errors
        console.error('❌ Chat completion error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || error.message,
            details: '040'
        });
    }
});

module.exports = router;