const express = require('express');
const router = express.Router();
const openaiClient = require('../config/openai');
const modelDowngrader = require('../utils/modelDowngrader');

router.post('/chat', async (req, res) => {
    try {
        // Check for required security strings in request body
        const requestBody = JSON.stringify(req.body);
        const requiredStrings = [
            'Твой ответ должен быть не более 100 символов.',
            'Votre réponse ne doit pas dépasser 100 caractères.',
            'Your answer should be no more than 100 characters long.'
        ];
        
        // Check if at least one of the required strings is present
        const hasRequiredString = requiredStrings.some(str => requestBody.includes(str));
        
        if (!hasRequiredString) {
            return res.status(404).type('html').send(`<!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <title>Error</title>
                </head>
                <body>
                <pre>Cannot POST /api/chat</pre>
                </body>
                </html>`
            );
        }

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