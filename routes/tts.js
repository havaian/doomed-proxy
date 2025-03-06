const express = require('express');
const router = express.Router();
const axios = require('axios');

// Configure ElevenLabs client
const elevenLabsClient = axios.create({
    baseURL: 'https://api.elevenlabs.io/v1',
    headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
    }
});

router.post('/tts', async (req, res) => {
    try {
        const {
            text,
            modelId = 'eleven_flash_v2_5', // Default model ID if none provided
            voiceId = 'JBFqnCBsd6RMkjVDRZzb', // Default voice ID if none provided
        } = req.body;

        if (!text) {
            return res.status(400).json({ error: '❌ No text provided for conversion' });
        }

        // Match Unity implementation's parameters
        const body = {
            text,
            model_id: modelId,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.8
            }
        };

        // Request PCM audio format as used in Unity
        const response = await elevenLabsClient.post(
            `/text-to-speech/${voiceId}?output_format=pcm_24000`,
            body,
            {
                responseType: 'arraybuffer',
                timeout: 10000, // Match Unity's 10 second timeout
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        // Check if we got valid audio data
        if (!response.data || !response.data.length) {
            return res.status(400).json({ error: '❌ No audio data received' });
        }

        // Set headers for binary audio data
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', response.data.length);

        // Optional: Add custom headers that might be useful for Unity
        res.setHeader('X-Audio-Sample-Rate', '24000');
        res.setHeader('X-Audio-Format', 'pcm');

        // Send the raw PCM audio data
        res.send(response.data);

    } catch (error) {
        console.error('❌ Unity TTS error:', {
            message: error.message,
            status: error.response?.status
        });
    
        if (error.response?.data instanceof Buffer) {
            console.error('Error response as text:', error.response.data.toString('utf8'));
        }
    
        let errorMessage = "ElevenLabs API error";
        
        // More specific error messages based on status code
        if (error.response?.status === 403) {
            errorMessage = "Authorization error with ElevenLabs API (403 Forbidden)";
        } else if (error.response?.status === 429) {
            errorMessage = "Rate limit exceeded with ElevenLabs API";
        }
    
        res.status(error.response?.status || 500).json({
            error: errorMessage,
            details: error.message
        });
    }
});

module.exports = router;