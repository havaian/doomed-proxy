const express = require('express');
const router = express.Router();
const openaiClient = require('../config/openai');

router.post('/chat', async (req, res) => {
    try {
        const messages = (req.body.Messages || req.body.messages || []).map(msg => ({
            role: msg.Role || msg.role,
            content: msg.Content || msg.content
        }));

        const body = {
            model: /* req.body.Model?.toLowerCase() || req.body.model */ "gpt-4-turbo",
            messages: messages,
            temperature: req.body.Temperature || req.body.temperature
        };

        const response = await openaiClient.post('/chat/completions', body);
        
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
            data: error.response?.data
        });
        
        res.status(error.response?.status || 500).json({
            error: error.response?.data?.error?.message || error.message
        });
    }
});

module.exports = router;