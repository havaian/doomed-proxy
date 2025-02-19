const express = require('express');
const compression = require('compression');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

require('dotenv').config();

const app = express();

// Optimize memory usage for 8GB RAM
const MEMORY_FOR_BUFFERS = Math.floor(8 * 1024 * 1024 * 1024 * 0.2); // 20% of 8GB for buffers

// Configure multer with NVMe optimization
const upload = multer({
    limits: {
        fileSize: Math.min(MEMORY_FOR_BUFFERS / 10, 10 * 1024 * 1024), // Max 10MB or memory limit
    },
    storage: multer.memoryStorage() // Use memory storage for NVMe speed advantage
});

// OpenAI API client configuration
const openaiClient = axios.create({
    baseURL: 'https://api.openai.com/v1',
    timeout: 30000,
    headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=5'
    },
    httpAgent: new require('http').Agent({
        keepAlive: true,
        maxSockets: 1000,        // Adjusted for 20TB traffic capacity
        maxFreeSockets: 100,
        timeout: 60000,
        keepAliveMsecs: 1000
    })
});

// Optimize compression for NVMe speed
app.use(compression({
    level: 6,
    threshold: 1024,            // Only compress if bigger than 1KB
    filter: (req, res) => {
        return req.headers['accept-encoding']?.includes('gzip');
    }
}));

app.use(express.json({
    limit: '1mb',
    strict: false              // Faster JSON parsing
}));

// OpenAI Chat Completion endpoint
app.post('/api/chat', async (req, res) => {
    try {
        // Validate request body
        if (!req.body.messages || !Array.isArray(req.body.messages)) {
            return res.status(400).json({ error: 'Invalid messages format. Expected an array of messages.' });
        }

        // Validate message format
        const invalidMessage = req.body.messages.find(msg => 
            !msg.role || !msg.content || 
            typeof msg.role !== 'string' || 
            typeof msg.content !== 'string'
        );
        
        if (invalidMessage) {
            return res.status(400).json({ 
                error: 'Invalid message format. Each message must have "role" and "content" as strings.' 
            });
        }

        const response = await openaiClient.post('/chat/completions', {
            model: 'gpt-4o-mini',
            messages: req.body.messages,
            temperature: req.body.temperature || 0.5
        });

        if (response.data.choices && response.data.choices.length > 0) {
            const message = response.data.choices[0].message;
            message.content = message.content.trim();
            res.json(message);
        } else {
            res.status(400).json({ error: 'No completion generated' });
        }
    } catch (error) {
        console.error('Chat completion error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.message
        });
    }
});

// OpenAI Audio Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const formData = new FormData();
        formData.append('file', new Blob([req.file.buffer], { type: 'audio/wav' }), 'audio.wav');
        formData.append('model', 'whisper-1');
        if (req.body.language) {
            formData.append('language', req.body.language);
        }

        const response = await openaiClient.post('/audio/transcriptions', formData, {
            headers: {
                ...openaiClient.defaults.headers,
                'Content-Type': 'multipart/form-data'
            },
            timeout: 60000  // 60 seconds timeout for audio processing
        });

        res.json({ text: response.data.text });
    } catch (error) {
        console.error('Transcription error:', error.message);
        res.status(error.response?.status || 500).json({
            error: error.message
        });
    }
});

// Optimize for 4 vCPUs
app.listen(8000, '0.0.0.0', () => {
    process.env.UV_THREADPOOL_SIZE = '4';  // Match vCPU count
    console.log(`Server running on port ${8000}`);
});