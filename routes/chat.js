const express = require('express');
const router = express.Router();
const openaiClient = require('../config/openai');
const { normalizeKeys } = require('../utils/normalize');

router.post('/chat', async (req, res) => {
    try {
        // Normalize the request body
        const normalizedBody = normalizeKeys(req.body);

        // Validate request body
        if (!normalizedBody.messages || !Array.isArray(normalizedBody.messages)) {
            console.error('❌ Invalid request structure:', JSON.stringify(normalizedBody));
            return res.status(400).json({ error: '❌ Invalid messages format. Expected an array of messages.' });
        }

        // Validate message format and log problematic messages
        const invalidMessage = normalizedBody.messages.find(msg => {
            const isInvalid = !msg.role || !msg.content || 
                typeof msg.role !== 'string' || 
                typeof msg.content !== 'string';
            
            if (isInvalid) {
                console.error('❌ Invalid message format:', JSON.stringify(msg));
            }
            return isInvalid;
        });
        
        if (invalidMessage) {
            return res.status(400).json({ 
                error: '❌ Invalid message format. Each message must have "role" and "content" as strings.' 
            });
        }

        // Validate model parameter
        if (!normalizedBody.model) {
            console.error('❌ Missing model parameter');
            return res.status(400).json({ error: '❌ Model parameter is required' });
        }

        const response = await openaiClient.post('/chat/completions', {
            model: normalizedBody.model,
            messages: normalizedBody.messages,
            temperature: normalizedBody.temperature || 0.5
        });

        if (response.data) {
            res.json(response.data);
        } else {
            console.error('❌ Empty response from OpenAI');
            res.status(400).json({ error: '❌ No completion generated' });
        }
    } catch (error) {
        console.error('❌ Chat completion error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            request: {
                model: req.body.model,
                messageCount: req.body.messages?.length
            }
        });
        
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || error.message
        });
    }
});

module.exports = router;